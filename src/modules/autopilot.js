/**
 * 24/7 Autopilot Daemon for FLOP Testnet (lightweight, ~40MB peak / 0MB idle via systemd timer).
 *
 * Monitors & automates on a polite interval (default: 600s / 10 min):
 *   1. Live FLOP Testnet RPC block height, genesis match, and runtime specVersion upgrades.
 *   2. Live Testnet Gateway health, serving models (`qwen/qwen3-14b`, `qwen/qwen3-8b`), and
 *      public wallet enrollment availability (`404 -> 200`).
 *   3. Automated daily signed 10 $FLOP Testnet faucet claims (respects 24h cooldowns &
 *      `agent_spend_missing` rollover rule without spamming).
 *   4. Optional bounded auto-spend (`--auto-spend --spend-max-flop 0.01`): the moment either
 *      public Testnet gateway wallet enrollment opens OR a verified miner publishes a public
 *      HTTPS direct session endpoint, executes a capped 0.01 FLOP Testnet inference (rate-limited
 *      by `--spend-interval-hours`, default 6h) and unlocks the next daily faucet rollover.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { c, drawBox, formatNum } from '../ansi.js';
import { NETWORKS, OFFICIAL_CLI, OFFICIAL_LINKS } from '../constants.js';
import {
  assertOfficialUrl,
  fetchNetworkSnapshot,
  probeFaucetIdentity,
  probeGatewayStatus,
} from '../rpc.js';
import { getKeysDir } from './agent.js';
import {
  getClaimsDir,
  loadSavedClaimState,
  saveClaimState,
  signWithKeystore,
  submitSignedTestnetClaim,
} from './claim.js';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function getSpendStatePath(address) {
  const safeAddr = String(address).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(getClaimsDir(), `${safeAddr}-spend.json`);
}

export function loadSpendState(address) {
  const p = getSpendStatePath(address);
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function saveSpendState(address, state) {
  const dir = getClaimsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const p = getSpendStatePath(address);
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  return p;
}

export function shouldAttemptAutoClaim({ health, faucet, savedState, nowMs = Date.now() }) {
  if (!health?.ok || !health?.ready) {
    return {
      attempt: false,
      reason: `faucet_not_ready (http=${health?.statusCode ?? '?'}, status=${health?.status ?? 'unknown'})`,
    };
  }
  if (!faucet?.ok || faucet?.detectedTarget !== 'testnet' || !faucet?.genesisVerified) {
    return {
      attempt: false,
      reason: `faucet_chain_unverified (target=${faucet?.detectedTarget ?? 'unknown'})`,
    };
  }
  if (faucet.faucetStatus !== 'open') {
    return {
      attempt: false,
      reason: `faucet_closed (status=${faucet.faucetStatus ?? 'unknown'})`,
    };
  }

  // If previous response said spend is required before rollover, wait until a spend clears it
  if (savedState?.status === 'agent_spend_missing' || savedState?.status === 'rollover_spend_required') {
    return {
      attempt: false,
      reason: `awaiting_onchain_spend (status=${savedState.status}; will retry automatically after next inference spend)`,
    };
  }

  // Respect 24h cooldown if a prior claim succeeded or faucet reported ip/address cooldown
  const cooldownStatuses = new Set(['ip_cooldown', 'address_cooldown']);
  const successStatuses = new Set(['submitted', 'included', 'confirmed', 'completed', 'ok']);
  const isGrantCooldown =
    savedState?.status !== 'spend_completed' &&
    savedState?.status !== 'grant_pending' &&
    Boolean(savedState?.txHash) &&
    (!savedState?.status || successStatuses.has(savedState.status));
  const isServerCooldown = cooldownStatuses.has(savedState?.status);

  if (isGrantCooldown || isServerCooldown) {
    const refIso = isGrantCooldown
      ? savedState.lastGrantAt || savedState.updatedAt || ''
      : savedState.updatedAt || '';
    const refMs = Date.parse(refIso);
    if (Number.isFinite(refMs) && nowMs - refMs < COOLDOWN_MS) {
      const hoursLeft = ((COOLDOWN_MS - (nowMs - refMs)) / 3600000).toFixed(1);
      return {
        attempt: false,
        reason: `cooldown_active (${hoursLeft}h left; status=${savedState.status}${savedState.txHash ? `, tx=${savedState.txHash}` : ''})`,
      };
    }
  }

  return { attempt: true, reason: 'faucet_ready' };
}

export function shouldAttemptAutoSpend({
  enabled,
  spendState,
  spendIntervalHours = 6,
  nowMs = Date.now(),
}) {
  if (!enabled) return { attempt: false, reason: 'auto_spend_disabled' };
  const intervalMs = Math.max(1, Number(spendIntervalHours) || 6) * 3600 * 1000;
  if (spendState?.lastSpendAt) {
    const lastMs = Date.parse(spendState.lastSpendAt);
    if (Number.isFinite(lastMs) && nowMs - lastMs < intervalMs) {
      const hoursLeft = ((intervalMs - (nowMs - lastMs)) / 3600000).toFixed(1);
      return { attempt: false, reason: `spend_interval_active (${hoursLeft}h left)` };
    }
  }
  return { attempt: true, reason: 'spend_window_open' };
}

export function validateTestnetEnrollChallenge(message, address, gatewayUrl, expectedGenesis, nowMs = Date.now()) {
  if (typeof message !== 'string') throw new Error('Invalid challenge message');
  const lines = message.split('\n');
  const host = new URL(gatewayUrl).host;
  if (
    lines.length !== 8 ||
    lines[0] !== `${host} wants you to enroll a FLOP testnet gateway key with your account:` ||
    lines[1] !== address ||
    lines[2] !== '' ||
    lines[3] !== 'Action: flop-testnet-enroll/v1' ||
    lines[4] !== `Genesis: ${expectedGenesis}` ||
    !/^Nonce: [0-9a-f]{64}$/.test(lines[5])
  ) {
    throw new Error('Testnet enrollment challenge failed strict format/genesis verification');
  }
  const issued = Date.parse(lines[6].replace(/^Issued At: /, ''));
  const expires = Date.parse(lines[7].replace(/^Expiration Time: /, ''));
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    expires <= nowMs ||
    expires <= issued ||
    expires - issued > 5 * 60 * 1000
  ) {
    throw new Error('Testnet enrollment challenge timestamps out of bounds');
  }
  return true;
}

export async function probeFaucetHealth(timeoutMs = 10000) {
  const url = assertOfficialUrl('https://faucet.flop.network/health');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'flop-kit/1.5.0', Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok && Boolean(json?.ready),
      statusCode: res.status,
      status: json?.status || (res.ok ? 'ok' : `http_${res.status}`),
      ready: Boolean(json?.ready),
      indexerOk: json?.dependencies?.indexer?.ok ?? null,
      indexerReason: json?.dependencies?.indexer?.reason || null,
      signingHeld: json?.dependencies?.signing?.held ?? null,
      version: json?.image?.version || null,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      status: 'unreachable',
      ready: false,
      error: err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeGatewayWalletEnrollment(address, timeoutMs = 8000) {
  const url = assertOfficialUrl(
    `${OFFICIAL_LINKS.gatewayTestnet}/v1/enroll/wallet/challenge?address=${encodeURIComponent(address)}`
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'flop-kit/1.5.0', Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (res.status === 200) {
      const data = await res.json().catch(() => null);
      return { open: Boolean(data?.message), statusCode: 200, message: data?.message || null };
    }
    return { open: false, statusCode: res.status, message: null };
  } catch (err) {
    return { open: false, statusCode: 0, error: err?.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function findDirectOfferMiner(timeoutMs = 8000) {
  const url = assertOfficialUrl('https://testnet.flopscan.io/api/miners');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'flop-kit/1.5.0', Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    for (const m of list) {
      if (!m?.isActive || m?.blacklisted) continue;
      const endpoint =
        m.sessionEndpoint ||
        m.directEndpoint ||
        m.directOffer?.endpoint ||
        m.endpoint ||
        null;
      if (typeof endpoint === 'string' && /^https:\/\/[a-z0-9.-]+/i.test(endpoint)) {
        return { address: m.address, endpoint };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function executeGatewayEnrollAndInference({
  keystorePath,
  password,
  address,
  challengeMessage,
  gw,
}) {
  const gatewayBase = OFFICIAL_LINKS.gatewayTestnet;
  const expectedGenesis = NETWORKS.testnet.expectedGenesis.toLowerCase();
  const keyFile = path.join(getKeysDir(), 'testnet-gateway-key.json');

  let bearerKey = null;
  let enrolledModel = null;

  // Reuse cached bearer key if valid
  if (fs.existsSync(keyFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
      if (cached?.key && cached?.gateway === gatewayBase) {
        const me = await fetch(assertOfficialUrl(`${gatewayBase}/v1/keys/me`), {
          headers: { Authorization: `Bearer ${cached.key}`, 'User-Agent': 'flop-kit/1.5.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (me.ok) {
          bearerKey = cached.key;
          enrolledModel = cached.model || null;
        }
      }
    } catch {
      bearerKey = null;
    }
  }

  // Otherwise sign official challenge and enroll
  if (!bearerKey) {
    validateTestnetEnrollChallenge(challengeMessage, address, gatewayBase, expectedGenesis);
    const signed = await signWithKeystore(keystorePath, password, challengeMessage);
    const enrollRes = await fetch(assertOfficialUrl(`${gatewayBase}/v1/enroll/wallet`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'flop-kit/1.5.0' },
      body: JSON.stringify({ address, message: challengeMessage, signature: signed.signature }),
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });
    if (!enrollRes.ok) {
      throw new Error(`Gateway enrollment failed: HTTP ${enrollRes.status} ${(await enrollRes.text()).slice(0, 200)}`);
    }
    const issued = await enrollRes.json();
    if (!issued?.key) throw new Error('Gateway enrollment did not return an API key');
    bearerKey = issued.key;
    enrolledModel = issued.model || null;
    fs.writeFileSync(
      keyFile,
      JSON.stringify({ gateway: gatewayBase, address, key: bearerKey, model: enrolledModel, savedAt: new Date().toISOString() }, null, 2) + '\n',
      { encoding: 'utf8', mode: 0o600 }
    );
  }

  const targetModel = enrolledModel || gw?.models?.[0]?.id || 'qwen/qwen3-8b';
  const compRes = await fetch(assertOfficialUrl(`${gatewayBase}/v1/chat/completions`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerKey}`,
      'User-Agent': 'flop-kit/1.5.0',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [{ role: 'user', content: 'Confirm FLOP Testnet Proof of Useful Inference in five words.' }],
      max_tokens: 32,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await compRes.json().catch(() => ({}));
  if (!compRes.ok) {
    throw new Error(`Gateway inference failed: HTTP ${compRes.status} ${JSON.stringify(body).slice(0, 200)}`);
  }

  return {
    lane: 'testnet_gateway',
    model: targetModel,
    miner: body?.x_flop_receipt?.miner || null,
    usage: body?.usage || null,
    replyPreview: body?.choices?.[0]?.message?.content?.slice(0, 80) || null,
  };
}

function executeDirectSessionSpend({
  keystorePath,
  passwordEnvName,
  miner,
  endpoint,
  model,
  maxFlop,
}) {
  const execBin = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const cliArgs = [
    '--yes',
    '--package',
    OFFICIAL_CLI.cliPackage,
    'flop',
    '--network',
    'testnet',
    '--rpc-timeout',
    '25000',
    '--keystore',
    keystorePath,
    '--password-env',
    passwordEnvName,
    'session',
    'run',
    '--miner',
    miner,
    '--endpoint',
    endpoint,
    '--model',
    model,
    '--prompt',
    'Confirm FLOP Testnet Proof of Useful Inference in five words.',
    '--max-flop',
    String(maxFlop),
    '--max-tokens',
    '64',
    '--via',
    'auto',
    '--json',
  ];
  const execArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx', ...cliArgs] : cliArgs;
  const out = execFileSync(execBin, execArgs, {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  });
  return {
    lane: 'direct_session_run',
    miner,
    endpoint,
    model,
    maxFlop,
    output: out.trim().slice(0, 300),
  };
}

function ts() {
  return new Date().toISOString();
}

export async function runAutopilot(lang = 'en', options = {}) {
  const intervalSec = Math.max(60, Number(options.interval) || 600);
  const once = Boolean(options.once);
  const keystorePath = options.keystore || path.join(getKeysDir(), 'agent-testnet.json');
  const passwordEnvName = options.passwordEnv || 'FLOP_KEYSTORE_PASSWORD';
  const password = process.env[passwordEnvName] || '';
  const autoSpend = Boolean(options.autoSpend);
  const spendMaxFlop = Number(options.spendMaxFlop) > 0 ? Number(options.spendMaxFlop) : 0.01;
  const spendIntervalHours = Number(options.spendIntervalHours) > 0 ? Number(options.spendIntervalHours) : 6;

  const hasKeystore = fs.existsSync(keystorePath);
  const walletReady = hasKeystore && Boolean(password);
  let keystoreAddress = null;
  if (hasKeystore) {
    try {
      keystoreAddress = JSON.parse(fs.readFileSync(keystorePath, 'utf8')).address || null;
    } catch {
      keystoreAddress = null;
    }
  }

  console.log(
    drawBox(
      'FLOP-KIT 24/7 AUTOPILOT DAEMON',
      [
        `Poll Interval:    ${c.cyan(`${intervalSec}s`)} (${(intervalSec / 60).toFixed(1)} min)  |  Mode: ${once ? 'single pass (--once)' : '24/7 daemon'}`,
        `Keystore:         ${hasKeystore ? c.green(keystorePath) : c.yellow(`not found (${keystorePath})`)}`,
        `Address:          ${keystoreAddress ? c.white(keystoreAddress) : c.gray('monitor-only (no keystore)')}`,
        `Daily Auto-Claim: ${walletReady ? c.brightGreen('ENABLED (10 $FLOP / 24h when ready)') : c.yellow(`MONITOR-ONLY (set ${passwordEnvName} + keystore)`)}`,
        `Auto-Spend:       ${autoSpend && walletReady ? c.brightCyan(`ARMED (max ${spendMaxFlop} FLOP · 1 tx / ${spendIntervalHours}h when public lane opens)`) : c.gray('disabled (pass --auto-spend to arm)')}`,
      ],
      { borderColor: c.cyan }
    )
  );

  let baselineSpec = null;
  let cycle = 0;
  let stopped = false;

  const stop = () => {
    stopped = true;
    console.log(`[${ts()}] [AUTOPILOT] Shutdown signal received. Exiting cleanly.`);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopped) {
      cycle += 1;
      const [tn, health, faucet, gw] = await Promise.all([
        fetchNetworkSnapshot('testnet'),
        probeFaucetHealth(),
        probeFaucetIdentity(),
        probeGatewayStatus(),
      ]);

      const tnSummary = tn.ok
        ? `block=#${formatNum(tn.bestBlock)} spec=v${tn.specVersion} genesis=${tn.genesisVerified ? 'OK' : 'MISMATCH'} peers=${tn.peers}`
        : `rpc_error=${tn.error}`;

      const gwSummary = `ok=${gw.ok} models=${gw.modelCount} miners=${gw.uniqueMinerCount}`;

      const faucetSummary = `health=${health.statusCode}/${health.status} ready=${health.ready} indexer=${health.indexerOk === false ? health.indexerReason || 'down' : health.indexerOk} queue=${faucet.pendingGrants ?? '?'} dailyLeft=${faucet.dailyRemainingFlop ?? '?'}`;

      console.log(`[${ts()}] [CYCLE #${cycle}] TESTNET(${tnSummary}) | GW(${gwSummary}) | FAUCET(${faucetSummary})`);

      // Alert loudly on runtime upgrade (possible scored activation block!)
      if (tn.ok && tn.specVersion !== null) {
        if (baselineSpec !== null && tn.specVersion !== baselineSpec) {
          console.log(
            `[${ts()}] [ALERT] Testnet runtime specVersion upgraded: v${baselineSpec} -> v${tn.specVersion}! Check ${OFFICIAL_LINKS.xOfficial} & ${OFFICIAL_LINKS.testnetDocs}`
          );
        }
        baselineSpec = tn.specVersion;
      }

      // 1) Auto-Spend lane check (0.01 FLOP bounded inference once public Testnet spending opens)
      if (autoSpend && walletReady && keystoreAddress && tn.ok && tn.genesisVerified) {
        const spendState = loadSpendState(keystoreAddress);
        const spendGate = shouldAttemptAutoSpend({
          enabled: autoSpend,
          spendState,
          spendIntervalHours,
        });

        if (!spendGate.attempt) {
          console.log(`[${ts()}] [SPEND-SKIP] ${spendGate.reason}`);
        } else {
          const [enrollProbe, directMiner] = await Promise.all([
            probeGatewayWalletEnrollment(keystoreAddress),
            findDirectOfferMiner(),
          ]);

          if (enrollProbe.open) {
            console.log(
              `[${ts()}] [ALERT] Public Testnet Gateway wallet enrollment is OPEN (HTTP 200)! Running capped inference...`
            );
            try {
              const spent = await executeGatewayEnrollAndInference({
                keystorePath,
                password,
                address: keystoreAddress,
                challengeMessage: enrollProbe.message,
                gw,
              });
              saveSpendState(keystoreAddress, {
                ...spent,
                address: keystoreAddress,
                maxFlop: spendMaxFlop,
                lastSpendAt: new Date().toISOString(),
                totalCount: (spendState?.totalCount || 0) + 1,
              });
              // Clear rollover spend block if present so daily claim unlocks
              const savedClaim = loadSavedClaimState(keystoreAddress);
              if (savedClaim && (savedClaim.status === 'agent_spend_missing' || savedClaim.status === 'rollover_spend_required')) {
                saveClaimState(keystoreAddress, { ...savedClaim, status: 'spend_completed' });
              }
              console.log(
                `[${ts()}] [SPEND-SUCCESS] lane=testnet_gateway model=${spent.model} miner=${spent.miner || 'gateway'} reply=${JSON.stringify(spent.replyPreview)}`
              );
            } catch (err) {
              console.log(`[${ts()}] [SPEND-ERR] gateway: ${err?.message || err}`);
            }
          } else if (directMiner) {
            const targetModel = gw?.models?.[0]?.id || 'qwen/qwen3-8b';
            console.log(
              `[${ts()}] [ALERT] Public direct-offer miner found (${directMiner.address} @ ${directMiner.endpoint})! Running ${spendMaxFlop} FLOP session...`
            );
            try {
              const spent = executeDirectSessionSpend({
                keystorePath,
                passwordEnvName,
                miner: directMiner.address,
                endpoint: directMiner.endpoint,
                model: targetModel,
                maxFlop: spendMaxFlop,
              });
              saveSpendState(keystoreAddress, {
                ...spent,
                address: keystoreAddress,
                lastSpendAt: new Date().toISOString(),
                totalCount: (spendState?.totalCount || 0) + 1,
              });
              const savedClaim = loadSavedClaimState(keystoreAddress);
              if (savedClaim && (savedClaim.status === 'agent_spend_missing' || savedClaim.status === 'rollover_spend_required')) {
                saveClaimState(keystoreAddress, { ...savedClaim, status: 'spend_completed' });
              }
              console.log(
                `[${ts()}] [SPEND-SUCCESS] lane=direct_session_run miner=${directMiner.address} maxFlop=${spendMaxFlop}`
              );
            } catch (err) {
              console.log(`[${ts()}] [SPEND-ERR] direct_session: ${err?.message || err}`);
            }
          } else {
            console.log(
              `[${ts()}] [SPEND-WAIT] public_inference_not_open_yet (gatewayEnroll=HTTP_${enrollProbe.statusCode}, directMiners=0, cap=${spendMaxFlop}_FLOP)`
            );
          }
        }
      }

      // 2) Automated daily 10 FLOP Testnet faucet claim
      if (walletReady && keystoreAddress) {
        const savedState = loadSavedClaimState(keystoreAddress);
        const decision = shouldAttemptAutoClaim({ health, faucet, savedState });

        if (!decision.attempt) {
          console.log(`[${ts()}] [CLAIM-SKIP] ${decision.reason}`);
        } else {
          console.log(
            `[${ts()}] [CLAIM-TRY] Faucet is READY — submitting signed 10 $FLOP claim for ${keystoreAddress}...`
          );
          try {
            const res = await submitSignedTestnetClaim({ keystorePath, password });
            if (res.ok) {
              console.log(
                `[${ts()}] [CLAIM-SUCCESS] 10 test $FLOP submitted! address=${res.address} nonce=${res.nonce} txHash=${res.response?.txHash || 'pending'}`
              );
            } else {
              console.log(
                `[${ts()}] [CLAIM-WAIT] http=${res.httpStatus} reason=${res.response?.reason || 'error'} nonce=${res.nonce} msg=${res.response?.error || 'see response'}`
              );
            }
          } catch (err) {
            console.log(`[${ts()}] [CLAIM-ERR] ${err?.message || err}`);
          }
        }
      }

      if (once || stopped) break;

      await new Promise((resolve) => {
        const timer = setTimeout(resolve, intervalSec * 1000);
        const checkStop = setInterval(() => {
          if (stopped) {
            clearTimeout(timer);
            clearInterval(checkStop);
            resolve();
          }
        }, 500);
        timer.unref?.();
        checkStop.unref?.();
      });
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
