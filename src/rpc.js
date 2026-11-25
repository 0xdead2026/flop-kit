/**
 * Zero-dependency JSON-RPC client & live faucet network probe for FLOP Network.
 * Strictly enforces official Flop Labs domain allowlist on every network call.
 */
import {
  NETWORKS,
  OFFICIAL_LINKS,
  OFFICIAL_ROOT_DOMAINS,
} from './constants.js';

export function isOfficialFlopHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return OFFICIAL_ROOT_DOMAINS.some(
    (root) => host === root || host.endsWith(`.${root}`)
  );
}

export function assertOfficialUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL blocked: ${rawUrl}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'wss:') {
    throw new Error(`Insecure protocol blocked: ${parsed.protocol}`);
  }
  if (!isOfficialFlopHost(parsed.hostname)) {
    throw new Error(`Non-official host blocked: ${parsed.hostname}`);
  }
  return parsed.toString();
}

export async function jsonRpcCall(rpcUrl, method, params = [], timeoutMs = 8000) {
  const safeUrl = assertOfficialUrl(rpcUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(safeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'flop-kit/1.0.0',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function jsonRpcBatch(rpcUrl, calls, timeoutMs = 10000) {
  const safeUrl = assertOfficialUrl(rpcUrl);
  const payload = calls.map((call, idx) => ({
    jsonrpc: '2.0',
    id: idx + 1,
    method: call.method,
    params: call.params || [],
  }));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(safeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'flop-kit/1.0.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 429 && attempt === 0) {
        const retryAfter = Math.min(3000, (Number(res.headers.get('retry-after')) || 1) * 1000);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Batch RPC not supported by endpoint');
      }
      const byId = new Map(data.map((item) => [item.id, item]));
      return calls.map((_, idx) => {
        const entry = byId.get(idx + 1);
        if (!entry || entry.error) return null;
        return entry.result;
      });
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('HTTP 429 Too Many Requests');
}

export function hexBlockToNumber(hex) {
  if (typeof hex === 'number') return hex;
  if (typeof hex !== 'string') return null;
  const parsed = parseInt(hex, 16);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function fetchNetworkSnapshot(networkKey = 'testnet') {
  const net = NETWORKS[networkKey];
  if (!net) throw new Error(`Unknown network: ${networkKey}`);

  const startedAt = Date.now();
  try {
    let results;
    const calls = [
      { method: 'chain_getBlockHash', params: [0] },
      { method: 'chain_getHeader', params: [] },
      { method: 'chain_getFinalizedHead', params: [] },
      { method: 'state_getRuntimeVersion', params: [] },
      { method: 'system_chain', params: [] },
      { method: 'system_health', params: [] },
    ];

    try {
      // Single HTTP batch request avoids rate-limit (HTTP 429) spikes
      results = await jsonRpcBatch(net.rpcHttp, calls);
    } catch (batchErr) {
      // Fallback to gentle sequential calls only if batching is disabled
      if (String(batchErr.message).includes('429')) throw batchErr;
      results = [];
      for (const call of calls) {
        try {
          results.push(await jsonRpcCall(net.rpcHttp, call.method, call.params));
        } catch {
          results.push(null);
        }
      }
    }

    const [
      genesisHash,
      bestHeader,
      finalizedHash,
      runtimeVersion,
      chainName,
      health,
    ] = results;

    if (!genesisHash && !bestHeader) {
      throw new Error('RPC returned empty response');
    }

    let finalizedBlock = null;
    if (finalizedHash) {
      try {
        const finHeader = await jsonRpcCall(net.rpcHttp, 'chain_getHeader', [
          finalizedHash,
        ]);
        finalizedBlock = hexBlockToNumber(finHeader?.number);
      } catch {
        finalizedBlock = null;
      }
    }

    const bestBlock = hexBlockToNumber(bestHeader?.number);
    const genesisVerified =
      typeof genesisHash === 'string' &&
      genesisHash.toLowerCase() === net.expectedGenesis.toLowerCase();

    return {
      ok: true,
      network: networkKey,
      rpcHttp: net.rpcHttp,
      latencyMs: Date.now() - startedAt,
      chainName: chainName || net.chainId,
      genesisHash: genesisHash || 'unavailable',
      expectedGenesis: net.expectedGenesis,
      genesisVerified,
      bestBlock,
      finalizedBlock,
      specName: runtimeVersion?.specName ?? null,
      specVersion: runtimeVersion?.specVersion ?? null,
      transactionVersion: runtimeVersion?.transactionVersion ?? null,
      peers: typeof health?.peers === 'number' ? health.peers : null,
      isSyncing: Boolean(health?.isSyncing),
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      network: networkKey,
      rpcHttp: net.rpcHttp,
      latencyMs: Date.now() - startedAt,
      error: err?.message || String(err),
      checkedAt: new Date().toISOString(),
    };
  }
}

export function parseFaucetApiProbe(chainInfo, limitsInfo, safeUrl) {
  const detectedTarget = String(chainInfo?.network || limitsInfo?.network || 'unknown').toLowerCase();
  const genesisHash = chainInfo?.genesisHash || null;
  const expected =
    detectedTarget === 'testnet'
      ? NETWORKS.testnet.expectedGenesis
      : detectedTarget === 'devnet'
        ? NETWORKS.devnet.expectedGenesis
        : null;
  const genesisVerified =
    Boolean(genesisHash && expected) &&
    genesisHash.toLowerCase() === expected.toLowerCase();

  const f = limitsInfo?.faucet || null;
  return {
    ok: true,
    statusCode: 200,
    url: safeUrl,
    detectedTarget,
    chain: chainInfo?.chain || null,
    genesisHash,
    genesisVerified,
    faucetStatus: f?.status || null,
    agentGrantFlop: f?.agent?.grantFlop ?? null,
    claimPath: f?.agent?.claimPath || null,
    rolloverRequiresSpend: f?.agent?.rolloverRequiresSpend ?? null,
    dailyRemainingFlop: f?.dailyCap?.remainingFlop ?? null,
    dailyLimitFlop: f?.dailyCap?.limitFlop ?? null,
    pendingGrants: typeof f?.pendingGrants === 'number' ? f.pendingGrants : null,
    checkedAt: new Date().toISOString(),
  };
}

export async function probeFaucetIdentity(timeoutMs = 8000) {
  const safeUrl = assertOfficialUrl(OFFICIAL_LINKS.faucet);
  const chainUrl = assertOfficialUrl('https://faucet.flop.network/chain');
  const limitsUrl = assertOfficialUrl('https://faucet.flop.network/limits');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [chainRes, limitsRes] = await Promise.all([
      fetch(chainUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'flop-kit/1.1.0', Accept: 'application/json' },
        signal: controller.signal,
      }),
      fetch(limitsUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'flop-kit/1.1.0', Accept: 'application/json' },
        signal: controller.signal,
      }).catch(() => null),
    ]);

    if (chainRes.ok) {
      const chainInfo = await chainRes.json();
      const limitsInfo = limitsRes && limitsRes.ok ? await limitsRes.json().catch(() => null) : null;
      return parseFaucetApiProbe(chainInfo, limitsInfo, safeUrl);
    }

    // Fallback to HTML probe if /chain is unavailable
    const res = await fetch(safeUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'flop-kit/1.1.0' },
      signal: controller.signal,
    });
    const html = await res.text();
    const lower = html.toLowerCase();

    const mentionsDevnet =
      lower.includes('devnet faucet') ||
      lower.includes('rpc.devnet.flop.network') ||
      lower.includes('network - devnet');
    const mentionsTestnet =
      lower.includes('testnet faucet') ||
      lower.includes('wss://testnet.flop.network') ||
      lower.includes('network - testnet') ||
      lower.includes('flop_testnet');

    let detectedTarget = 'unknown';
    if (mentionsTestnet && !mentionsDevnet) detectedTarget = 'testnet';
    else if (mentionsDevnet && !mentionsTestnet) detectedTarget = 'devnet';
    else if (mentionsDevnet && mentionsTestnet) detectedTarget = 'mixed';

    return {
      ok: res.ok,
      statusCode: res.status,
      url: safeUrl,
      detectedTarget,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      url: safeUrl,
      detectedTarget: 'unreachable',
      error: err?.message || String(err),
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFullTelemetry() {
  const [testnet, devnet, faucet] = await Promise.all([
    fetchNetworkSnapshot('testnet'),
    fetchNetworkSnapshot('devnet'),
    probeFaucetIdentity(),
  ]);
  return { testnet, devnet, faucet, checkedAt: new Date().toISOString() };
}
