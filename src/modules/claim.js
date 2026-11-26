/**
 * Signed FLOP Testnet Agent Faucet Claim Module (10 test $FLOP / rolling 24h).
 *
 * Implements the official protocol documented in https://flop.network/llms.txt
 * ("## Get Testnet FLOP"):
 *   1. Verify GET https://faucet.flop.network/chain matches Testnet genesis & live RPC block 0.
 *   2. Verify GET https://faucet.flop.network/limits shows faucet.status === "open"
 *      and claimPath === "/v1/testnet/agent-claims".
 *   3. Sign UTF-8 challenge: flop-faucet-agent/v1|<genesisHash>|<address>|<nonce>
 *   4. POST https://faucet.flop.network/v1/testnet/agent-claims with { address, nonce, signature }.
 *   5. Persist pending nonce locally (~/.flop-kit/claims/<address>.json) for safe idempotent retries
 *      (never stores passwords or private keys).
 *
 * Zero-dependency architecture: locates @polkadot/keyring + @polkadot/util-crypto from the
 * official @flop-labs/cli@0.8.3 cache so flop-kit keeps `"dependencies": {}`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { askLine, badge, c, drawBox, formatNum } from '../ansi.js';
import { NETWORKS, OFFICIAL_CLI, OFFICIAL_LINKS } from '../constants.js';
import { assertOfficialUrl, jsonRpcCall, probeFaucetIdentity } from '../rpc.js';
import { getKeysDir } from './agent.js';

export const AGENT_CLAIM_PREFIX = 'flop-faucet-agent/v1';

export function validateClaimNonce(nonce) {
  const s = String(nonce ?? '').trim();
  return /^[1-9]\d{0,18}$/.test(s);
}

export function buildAgentClaimMessage(genesisHash, address, nonce) {
  if (!genesisHash || !/^0x[0-9a-fA-F]{64}$/.test(genesisHash)) {
    throw new Error(`Invalid genesisHash: ${genesisHash}`);
  }
  if (!address || typeof address !== 'string' || address.trim().length < 20) {
    throw new Error(`Invalid SS58 address: ${address}`);
  }
  if (!validateClaimNonce(nonce)) {
    throw new Error(`Nonce must be a canonical decimal string up to 19 digits (got "${nonce}")`);
  }
  return `${AGENT_CLAIM_PREFIX}|${genesisHash.toLowerCase()}|${address.trim()}|${String(nonce).trim()}`;
}

export function getClaimsDir() {
  return path.join(os.homedir(), '.flop-kit', 'claims');
}

export function getClaimStatePath(address) {
  const safeAddr = String(address).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(getClaimsDir(), `${safeAddr}.json`);
}

export function loadSavedClaimState(address) {
  const filePath = getClaimStatePath(address);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function saveClaimState(address, state) {
  const dir = getClaimsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filePath = getClaimStatePath(address);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  return filePath;
}

function findPolkadotNodeModules() {
  const candidates = [];

  // 1. Official npx cache locations (Windows & Unix)
  const localAppData = process.env.LOCALAPPDATA;
  const npxRoots = [
    localAppData ? path.join(localAppData, 'npm-cache', '_npx') : null,
    path.join(os.homedir(), '.npm', '_npx'),
    process.env.npm_config_cache ? path.join(process.env.npm_config_cache, '_npx') : null,
  ].filter(Boolean);

  for (const root of npxRoots) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const nm = path.join(root, ent.name, 'node_modules');
      if (
        fs.existsSync(path.join(nm, '@flop-labs', 'cli')) &&
        fs.existsSync(path.join(nm, '@polkadot', 'keyring', 'index.js')) &&
        fs.existsSync(path.join(nm, '@polkadot', 'util-crypto', 'index.js'))
      ) {
        candidates.push(nm);
      }
    }
  }

  return candidates[0] || null;
}

function ensurePolkadotModules() {
  let nm = findPolkadotNodeModules();
  if (nm) return nm;

  // Warm official @flop-labs/cli@0.8.3 npx cache cleanly (no extra third-party deps)
  const execBin = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const execArgs =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx', '--yes', '--package', OFFICIAL_CLI.cliPackage, 'flop', '--version']
      : ['--yes', '--package', OFFICIAL_CLI.cliPackage, 'flop', '--version'];
  execFileSync(execBin, execArgs, {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  nm = findPolkadotNodeModules();
  if (!nm) {
    throw new Error(
      `Could not locate @polkadot/keyring inside official ${OFFICIAL_CLI.cliPackage} cache.`
    );
  }
  return nm;
}

export async function signWithKeystore(keystorePath, password, message) {
  if (!fs.existsSync(keystorePath)) {
    throw new Error(`Keystore file not found: ${keystorePath}`);
  }
  if (!password) {
    throw new Error('Keystore password is required (set FLOP_KEYSTORE_PASSWORD env var).');
  }

  const nm = ensurePolkadotModules();
  const { cryptoWaitReady } = await import(
    pathToFileURL(path.join(nm, '@polkadot', 'util-crypto', 'index.js')).href
  );
  const { Keyring } = await import(
    pathToFileURL(path.join(nm, '@polkadot', 'keyring', 'index.js')).href
  );
  await cryptoWaitReady();

  const json = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  const keyring = new Keyring({ ss58Format: 42 });
  const pair = keyring.addFromJson(json);
  pair.decodePkcs8(password);

  const sigBytes = pair.sign(new TextEncoder().encode(message));
  return {
    address: pair.address,
    signature: `0x${Buffer.from(sigBytes).toString('hex')}`,
  };
}

export async function submitSignedTestnetClaim({
  keystorePath,
  password,
  explicitNonce,
  forceNewNonce = false,
} = {}) {
  const expectedGenesis = NETWORKS.testnet.expectedGenesis.toLowerCase();

  // Step 1: Verify faucet /chain & /limits AND live Testnet RPC genesis block 0
  const [faucetProbe, rpcGenesis] = await Promise.all([
    probeFaucetIdentity(10000),
    jsonRpcCall(NETWORKS.testnet.rpcHttp, 'chain_getBlockHash', [0], 10000),
  ]);

  if (!faucetProbe.ok || faucetProbe.detectedTarget !== 'testnet') {
    throw new Error(
      `Faucet does not report FLOP Testnet (detected: ${faucetProbe.detectedTarget}). Aborting before signing.`
    );
  }
  if (!faucetProbe.genesisVerified) {
    throw new Error(
      `Faucet genesis mismatch: got ${faucetProbe.genesisHash}, expected ${expectedGenesis}`
    );
  }
  if (!rpcGenesis || rpcGenesis.toLowerCase() !== expectedGenesis) {
    throw new Error(
      `Live Testnet RPC genesis mismatch: got ${rpcGenesis}, expected ${expectedGenesis}`
    );
  }
  if (faucetProbe.faucetStatus !== 'open') {
    throw new Error(`Testnet faucet is not open (status: ${faucetProbe.faucetStatus || 'unknown'}).`);
  }

  const claimPath = faucetProbe.claimPath || '/v1/testnet/agent-claims';
  const claimUrl = assertOfficialUrl(`https://faucet.flop.network${claimPath}`);

  // Step 2: Read address from keystore JSON (public metadata) to resolve idempotent nonce
  const keystoreMeta = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  const address = keystoreMeta.address;
  if (!address) {
    throw new Error(`Keystore missing SS58 address field: ${keystorePath}`);
  }

  const saved = loadSavedClaimState(address);
  let nonce;
  let reusedPendingNonce = false;
  // Only reuse a saved nonce when the faucet actually queued/accepted it or timed out
  // ambiguously (504 / 429). Never pin a nonce on unqueued errors like indexer_unavailable
  // or origin 502 Bad Gateway (which can loop forever after a faucet server upgrade).
  const reusableStatuses = new Set([
    'grant_pending',
    'included',
    'submitted',
    'http_429',
    'http_504',
  ]);
  const savedAgeMs = saved?.updatedAt ? Date.now() - Date.parse(saved.updatedAt) : Infinity;
  const maxReuseAgeMs = 4 * 60 * 60 * 1000; // 4 hours

  if (explicitNonce) {
    nonce = String(explicitNonce).trim();
  } else if (
    !forceNewNonce &&
    saved?.nonce &&
    reusableStatuses.has(saved?.status) &&
    Number.isFinite(savedAgeMs) &&
    savedAgeMs < maxReuseAgeMs
  ) {
    nonce = String(saved.nonce);
    reusedPendingNonce = true;
  } else {
    nonce = String(Date.now());
  }

  const message = buildAgentClaimMessage(expectedGenesis, address, nonce);

  // Step 3: Sign challenge with recipient sr25519/ed25519 keystore
  const signed = await signWithKeystore(keystorePath, password, message);
  if (signed.address !== address) {
    throw new Error(`Decoded keystore address (${signed.address}) differs from metadata (${address}).`);
  }

  // Step 4: Submit POST to official /v1/testnet/agent-claims
  const res = await fetch(claimUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flop-kit/1.1.0',
    },
    body: JSON.stringify({
      address,
      nonce,
      signature: signed.signature,
    }),
    signal: AbortSignal.timeout(45000),
  });

  const rawText = await res.text();
  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { raw: rawText };
  }

  const statusTag = body?.success
    ? body.status || 'submitted'
    : body?.reason || `http_${res.status}`;

  // Persist idempotent state (strictly public fields only — NO secrets)
  saveClaimState(address, {
    network: 'testnet',
    address,
    nonce,
    genesisHash: expectedGenesis,
    claimUrl,
    httpStatus: res.status,
    status: statusTag,
    txHash: body?.txHash || saved?.txHash || null,
    amountFlop: body?.amount ?? faucetProbe.agentGrantFlop ?? 10,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: Boolean(res.ok && body?.success),
    httpStatus: res.status,
    address,
    nonce,
    reusedPendingNonce,
    claimUrl,
    faucet: faucetProbe,
    response: body,
  };
}

export async function runClaimModule(lang = 'en', options = {}) {
  const isTr = lang === 'tr';
  const defaultKeystore = path.join(getKeysDir(), 'agent-testnet.json');

  // Quick status-only check mode
  if (options.check) {
    const probe = await probeFaucetIdentity(10000);
    if (options.json) {
      console.log(JSON.stringify(probe, null, 2));
      return probe;
    }
    console.log('');
    console.log(
      drawBox(
        isTr ? 'TESTNET FAUCET HAZIRLIK KONTROLÜ' : 'TESTNET FAUCET READINESS CHECK',
        [
          `Endpoint:          ${c.cyan(probe.url)}`,
          `Target Network:    ${probe.detectedTarget === 'testnet' ? badge('TESTNET', 'green') : badge(String(probe.detectedTarget).toUpperCase(), 'yellow')}`,
          `Genesis Match:     ${probe.genesisVerified ? badge('VERIFIED', 'green') : badge('UNVERIFIED', 'red')}`,
          `Faucet Status:     ${probe.faucetStatus === 'open' ? badge('OPEN', 'green') : badge(String(probe.faucetStatus || '?').toUpperCase(), 'yellow')}`,
          `Agent Grant:       ${c.white(`${probe.agentGrantFlop ?? 10} test $FLOP / 24h`)}  ${c.gray(`(${probe.claimPath || '/v1/testnet/agent-claims'})`)}`,
          `Daily Remaining:   ${c.brightGreen(formatNum(probe.dailyRemainingFlop) + ' FLOP')}  |  Pending Queue: ${c.yellow(formatNum(probe.pendingGrants))}`,
          `Protocol Ref:      ${c.gray(OFFICIAL_LINKS.agentLlmsGuide)}`,
        ],
        { borderColor: c.cyan }
      )
    );
    return probe;
  }

  let keystorePath = options.keystore || defaultKeystore;
  const passwordEnvName = options.passwordEnv || 'FLOP_KEYSTORE_PASSWORD';
  let password = process.env[passwordEnvName] || '';

  if (!options.json && process.stdin.isTTY && !options.keystore) {
    console.log('');
    console.log(
      drawBox(
        isTr ? 'İMZALI TESTNET FAUCET TALEBİ (10 $FLOP / 24S)' : 'SIGNED TESTNET FAUCET CLAIM (10 $FLOP / 24H)',
        isTr
          ? [
              '• Resmi https://flop.network/llms.txt protokolünü uygular (flop-faucet-agent/v1).',
              '• İmzalamadan önce faucet /chain ile canlı Testnet RPC genesis hash eşleşmesini doğrular.',
              '• Kuyrukta (grant_pending) kalırsa aynı idempotent nonce değerini otomatik korur.',
              `• Varsayılan keystore: ${c.cyan(defaultKeystore)}`,
            ]
          : [
              '• Implements the official https://flop.network/llms.txt protocol (flop-faucet-agent/v1).',
              '• Verifies faucet /chain against live Testnet RPC block 0 genesis BEFORE signing.',
              '• Persists pending nonce automatically for safe idempotent retries (never saves passwords).',
              `• Default keystore: ${c.cyan(defaultKeystore)}`,
            ],
        { borderColor: c.cyan }
      )
    );

    const enteredPath = await askLine(
      c.brightCyan(
        isTr
          ? `\nKeystore yolu [Enter = ${defaultKeystore}]: `
          : `\nKeystore path [Enter = ${defaultKeystore}]: `
      )
    );
    if (enteredPath) keystorePath = enteredPath;
  }

  if (!fs.existsSync(keystorePath)) {
    const msg = isTr
      ? `Keystore bulunamadı: ${keystorePath}\nÖnce resmi CLI ile yeni sr25519 Agent cüzdanı oluştur:\n  npx --yes --package ${OFFICIAL_CLI.cliPackage} flop keys generate --name flop-agent-testnet --type sr25519 --out "${keystorePath}" --password-env ${passwordEnvName}`
      : `Keystore not found: ${keystorePath}\nFirst create a dedicated sr25519 Agent keystore with official CLI:\n  npx --yes --package ${OFFICIAL_CLI.cliPackage} flop keys generate --name flop-agent-testnet --type sr25519 --out "${keystorePath}" --password-env ${passwordEnvName}`;
    if (options.json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.log('\n' + c.yellow(msg));
    }
    return { ok: false, error: msg };
  }

  if (!password) {
    const msg = isTr
      ? `${passwordEnvName} ortam değişkeni boş. Güvenlik için parolayı ortam değişkeniyle ver:\n  PowerShell: $env:${passwordEnvName} = "PAROLAN"; node bin/flop-kit.js claim\n  Bash/Zsh:   ${passwordEnvName}="PAROLAN" node bin/flop-kit.js claim`
      : `${passwordEnvName} env var is not set. Pass the keystore password via environment variable:\n  PowerShell: $env:${passwordEnvName} = "YOUR_PASSWORD"; node bin/flop-kit.js claim\n  Bash/Zsh:   ${passwordEnvName}="YOUR_PASSWORD" node bin/flop-kit.js claim`;
    if (options.json) {
      console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
    } else {
      console.log('\n' + c.yellow(msg));
    }
    return { ok: false, error: msg };
  }

  if (!options.json) {
    console.log(
      c.dim(
        isTr
          ? '\nTestnet genesis doğrulanıyor, mesaj imzalanıyor ve talep gönderiliyor...'
          : '\nVerifying Testnet genesis, signing challenge, and submitting claim...'
      )
    );
  }

  const result = await submitSignedTestnetClaim({
    keystorePath,
    password,
    explicitNonce: options.nonce,
    forceNewNonce: Boolean(options.newNonce),
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const isPending = result.response?.reason === 'grant_pending';
  const statusBadge = result.ok
    ? badge(isTr ? 'BAŞARILI' : 'SUBMITTED', 'green')
    : isPending
      ? badge('QUEUED / PENDING', 'yellow')
      : badge(`HTTP ${result.httpStatus}`, 'red');

  const lines = [
    `Status:          ${statusBadge}`,
    `Address:         ${c.white(result.address)}`,
    `Nonce:           ${c.cyan(result.nonce)} ${result.reusedPendingNonce ? c.gray('(reused pending idempotent nonce)') : ''}`,
    `Endpoint:        ${c.gray(result.claimUrl)}`,
    `Daily Left:      ${c.brightGreen(formatNum(result.faucet.dailyRemainingFlop) + ' FLOP')}  |  Queue: ${c.yellow(formatNum(result.faucet.pendingGrants))}`,
  ];

  if (result.response?.txHash) {
    lines.push(`Tx Hash:         ${c.brightGreen(result.response.txHash)}`);
  }
  if (result.response?.error) {
    lines.push(`Message:         ${c.yellow(result.response.error)}`);
  }
  if (isPending) {
    lines.push(
      '',
      c.gray(
        isTr
          ? `Not: Talebin sırada. Aynı komutu ~${result.response.retryAfterSeconds || 60}s sonra tekrar çalıştırırsan aynı nonce otomatik kullanılır.`
          : `Note: Your grant is queued. Re-run 'flop-kit claim' after ~${result.response.retryAfterSeconds || 60}s — the same idempotent nonce is reused automatically.`
      )
    );
  }

  console.log('');
  console.log(
    drawBox(
      isTr ? 'TESTNET FAUCET TALEP SONUCU' : 'TESTNET FAUCET CLAIM RESULT',
      lines,
      { borderColor: result.ok ? c.green : isPending ? c.yellow : c.red }
    )
  );
  return result;
}
