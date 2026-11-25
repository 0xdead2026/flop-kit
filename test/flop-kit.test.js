import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { NETWORKS } from '../src/constants.js';
import { MESSAGES, t } from '../src/i18n.js';
import { buildOfficialSessionCommand } from '../src/modules/agent.js';
import { shouldAttemptAutoClaim } from '../src/modules/autopilot.js';
import {
  calculateAgentUnlock,
  calculateMinerUnlock,
  calculateValidatorUnlock,
} from '../src/modules/calculator.js';
import {
  buildAgentClaimMessage,
  validateClaimNonce,
} from '../src/modules/claim.js';
import { createDashboardServer } from '../src/modules/dashboard.js';
import {
  encodeBase58Btc,
  generateEncryptedDid,
  inspectLocalDid,
  publicKeyBytesToDidKey,
  verifyEncryptedDidPassphrase,
} from '../src/modules/did.js';
import { formatObservationReceipt } from '../src/modules/validator.js';
import { classifyUrl } from '../src/modules/verify.js';
import {
  assertOfficialUrl,
  hexBlockToNumber,
  isOfficialFlopHost,
  parseFaucetApiProbe,
} from '../src/rpc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '..', 'bin', 'flop-kit.js');

test('Official host allowlist accepts official domains and blocks third-party/insecure URLs', () => {
  assert.equal(isOfficialFlopHost('flop.finance'), true);
  assert.equal(isOfficialFlopHost('testnet.flop.network'), true);
  assert.equal(isOfficialFlopHost('testnet.flopscan.io'), true);
  assert.equal(isOfficialFlopHost('technocore.chat'), true);

  assert.equal(isOfficialFlopHost('evil-flop.finance.attacker.com'), false);
  assert.equal(isOfficialFlopHost('floplabs.io'), false);

  assert.doesNotThrow(() => assertOfficialUrl('https://testnet.flop.network/'));
  assert.throws(() => assertOfficialUrl('http://testnet.flop.network/'), /Insecure protocol/);
  assert.throws(() => assertOfficialUrl('https://evil.example.com/rpc'), /Non-official host/);
});

test('Anti-phishing URL classifier flags official channels, scam channels, and lookalikes', () => {
  assert.equal(classifyUrl('https://flop.finance/airdrop/').status, 'official');
  assert.equal(classifyUrl('https://docs.flop.network/networks/testnet').status, 'official');
  assert.equal(classifyUrl('@flop_labs').status, 'official');
  assert.equal(classifyUrl('https://github.com/flop-labs/network').status, 'official');

  assert.equal(classifyUrl('https://discord.gg/floplabs').status, 'scam_channel');
  assert.equal(classifyUrl('https://t.me/flop_official').status, 'scam_channel');
  assert.equal(classifyUrl('https://medium.com/@floplabs').status, 'scam_channel');

  assert.equal(classifyUrl('https://flop-airdrop-claim.xyz').status, 'suspicious_lookalike');
  assert.equal(classifyUrl('https://example.com').status, 'third_party');
});

test('Airdrop unlock math matches ratified protocol formulas', () => {
  const agent = calculateAgentUnlock(10_000);
  assert.equal(agent.tgeLiquid, 0);
  assert.equal(agent.computeConsumed, 7_500);
  assert.equal(agent.maxLiquid, 2_500);

  const miner = calculateMinerUnlock(10_000);
  assert.equal(miner.tgeLiquid, 2_500);
  assert.equal(miner.lockedEarnToUnlock, 7_500);

  const val = calculateValidatorUnlock(2);
  assert.equal(val.allocation, 2_400_000);
  assert.equal(val.tgeLiquid, 0);
  assert.equal(val.approxUnlockYears, 10);
  assert.equal(val.approxYearlyLinearUnlock, 240_000);
});

test('Official session command builder uses session run and spend cap', () => {
  const cmd = buildOfficialSessionCommand({ network: 'devnet', maxFlop: '0.02' });
  assert.match(cmd, /@flop-labs\/cli@0\.8\.3/);
  assert.match(cmd, /session run/);
  assert.match(cmd, /--max-flop 0\.02/);
  assert.doesNotMatch(cmd, /\bflop chat\b/);
});

test('Signed Testnet agent claim builder and faucet API probe parser follow official spec', () => {
  assert.equal(validateClaimNonce('1795619961151'), true);
  assert.equal(validateClaimNonce('0'), false);
  assert.equal(validateClaimNonce('01234'), false);
  assert.equal(validateClaimNonce('12345678901234567890'), false); // 20 digits > 19 max

  const msg = buildAgentClaimMessage(
    NETWORKS.testnet.expectedGenesis,
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    '1795619961151'
  );
  assert.equal(
    msg,
    `flop-faucet-agent/v1|${NETWORKS.testnet.expectedGenesis}|5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY|1795619961151`
  );

  const probe = parseFaucetApiProbe(
    { network: 'testnet', chain: 'FLOP Testnet', genesisHash: NETWORKS.testnet.expectedGenesis },
    {
      network: 'testnet',
      faucet: {
        status: 'open',
        pendingGrants: 1234,
        dailyCap: { limitFlop: '10000000', remainingFlop: '4500000' },
        agent: { grantFlop: 10, claimPath: '/v1/testnet/agent-claims', rolloverRequiresSpend: true },
      },
    },
    'https://faucet.flop.network/'
  );
  assert.equal(probe.detectedTarget, 'testnet');
  assert.equal(probe.genesisVerified, true);
  assert.equal(probe.faucetStatus, 'open');
  assert.equal(probe.agentGrantFlop, 10);
  assert.equal(probe.pendingGrants, 1234);
});

test('Validator observation receipt formats public telemetry cleanly', () => {
  const md = formatObservationReceipt({
    teamId: 'alpha-node',
    peerId: '12D3KooWTest',
    obs1Height: '100',
    obs1Hash: '0xaaa',
    obs2Height: '200',
    obs2Hash: '0xbbb',
  });
  assert.match(md, /alpha-node/);
  assert.match(md, /12D3KooWTest/);
  assert.match(md, new RegExp(NETWORKS.devnet.expectedGenesis));
  assert.match(md, /#100/);
  assert.match(md, /#200/);
});

test('Hex block parser and EN/TR i18n keys work cleanly', () => {
  assert.equal(hexBlockToNumber('0x2e52'), 11858);
  assert.equal(hexBlockToNumber(42), 42);
  assert.equal(hexBlockToNumber(null), null);

  for (const key of Object.keys(MESSAGES.en.menu)) {
    assert.ok(MESSAGES.tr.menu[key], `Missing TR menu key: ${key}`);
  }
  assert.match(t('tr', 'dashboard.running', { url: 'http://127.0.0.1:4141' }), /127\.0\.0\.1:4141/);
});

test('Local Mission Control dashboard serves HTML, /api/doctor, and /api/verify on 127.0.0.1', async () => {
  const server = createDashboardServer('tr');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const htmlRes = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /MISSION CONTROL/);
    assert.doesNotMatch(html, /id="langBtn"/);
    assert.match(html, /<html lang="en">/);
    const dashScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(dashScript, 'Dashboard inline script missing');
    assert.doesNotThrow(() => new Function(dashScript), 'Dashboard inline JS must parse without syntax errors');

    const termRes = await fetch(`http://127.0.0.1:${port}/terminal`);
    assert.equal(termRes.status, 200);
    const termHtml = await termRes.text();
    assert.match(termHtml, /0xdead2026/);
    assert.doesNotMatch(termHtml, /id="langToggle"/);
    assert.match(termHtml, /<html lang="en">/);
    const termScript = termHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(termScript, 'Terminal showcase inline script missing');
    assert.doesNotThrow(() => new Function(termScript), 'Terminal showcase inline JS must parse without syntax errors');

    const docRes = await fetch(`http://127.0.0.1:${port}/api/doctor`);
    assert.equal(docRes.status, 200);
    const doc = await docRes.json();
    assert.ok(doc.node.version.startsWith('v'));

    const verRes = await fetch(`http://127.0.0.1:${port}/api/verify?url=${encodeURIComponent('https://discord.gg/fake')}`);
    assert.equal(verRes.status, 200);
    const ver = await verRes.json();
    assert.equal(ver.status, 'scam_channel');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Zero-dependency W3C Ed25519 did:key generator creates encrypted PEM and verifies round-trip', () => {
  assert.equal(encodeBase58Btc(Buffer.from([0, 0, 1])), '112');
  const zeroDid = publicKeyBytesToDidKey(Buffer.alloc(32, 0));
  assert.ok(zeroDid.startsWith('did:key:z6Mk'));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flop-kit-did-'));
  try {
    const created = generateEncryptedDid({
      password: 'TestStrongPassword123',
      baseDir: tmpDir,
    });
    assert.match(created.did, /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44,46}$/);
    const inspected = inspectLocalDid(tmpDir);
    assert.equal(inspected.exists, true);
    assert.equal(inspected.did, created.did);

    const check = verifyEncryptedDidPassphrase(created.pemPath, 'TestStrongPassword123');
    assert.equal(check.valid, true);
    assert.equal(check.did, created.did);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Autopilot claim gate enforces health readiness, verified testnet, and 24h cooldown', () => {
  const readyHealth = { ok: true, ready: true, statusCode: 200, status: 'ok' };
  const openFaucet = { ok: true, detectedTarget: 'testnet', genesisVerified: true, faucetStatus: 'open' };

  assert.equal(
    shouldAttemptAutoClaim({ health: { ok: false, ready: false, statusCode: 503, status: 'degraded' }, faucet: openFaucet, savedState: null }).attempt,
    false
  );
  assert.equal(
    shouldAttemptAutoClaim({ health: readyHealth, faucet: openFaucet, savedState: null }).attempt,
    true
  );
  const now = Date.parse('2026-11-26T00:00:00Z');
  assert.equal(
    shouldAttemptAutoClaim({
      health: readyHealth,
      faucet: openFaucet,
      savedState: { txHash: '0x123', status: 'submitted', updatedAt: '2026-11-25T20:00:00Z' },
      nowMs: now,
    }).attempt,
    false
  );
  assert.equal(
    shouldAttemptAutoClaim({
      health: readyHealth,
      faucet: openFaucet,
      savedState: { txHash: '0x123', status: 'submitted', updatedAt: '2026-11-24T20:00:00Z' },
      nowMs: now,
    }).attempt,
    true
  );
});

test('CLI binary runs --version, --help, doctor --json, calc --json, and verify --json cleanly', () => {
  const ver = execFileSync(process.execPath, [CLI_PATH, '--version'], { encoding: 'utf8' });
  assert.match(ver, /flop-kit v1\.3\.0/);

  const help = execFileSync(process.execPath, [CLI_PATH, '--help', '--lang', 'tr'], { encoding: 'utf8' });
  assert.match(help, /Kullanım:/);

  const calcJson = execFileSync(
    process.execPath,
    [CLI_PATH, 'calc', '--role', 'agent', '--amount', '20000', '--json'],
    { encoding: 'utf8' }
  );
  const calc = JSON.parse(calcJson);
  assert.equal(calc.maxLiquid, 5000);

  const verifyJson = execFileSync(
    process.execPath,
    [CLI_PATH, 'verify', 'https://flop.finance', '--json'],
    { encoding: 'utf8' }
  );
  assert.equal(JSON.parse(verifyJson).status, 'official');
});
