import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { NETWORKS } from '../src/constants.js';
import { MESSAGES, t } from '../src/i18n.js';
import { buildOfficialSessionCommand } from '../src/modules/agent.js';
import {
  calculateAgentUnlock,
  calculateMinerUnlock,
  calculateValidatorUnlock,
} from '../src/modules/calculator.js';
import { createDashboardServer } from '../src/modules/dashboard.js';
import { formatObservationReceipt } from '../src/modules/validator.js';
import { classifyUrl } from '../src/modules/verify.js';
import { assertOfficialUrl, hexBlockToNumber, isOfficialFlopHost } from '../src/rpc.js';

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
  assert.match(cmd, /@flop-labs\/cli@0\.7\.0/);
  assert.match(cmd, /session run/);
  assert.match(cmd, /--max-flop 0\.02/);
  assert.doesNotMatch(cmd, /\bflop chat\b/);
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
    const dashScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(dashScript, 'Dashboard inline script missing');
    assert.doesNotThrow(() => new Function(dashScript), 'Dashboard inline JS must parse without syntax errors');

    const termRes = await fetch(`http://127.0.0.1:${port}/terminal`);
    assert.equal(termRes.status, 200);
    const termHtml = await termRes.text();
    assert.match(termHtml, /0xdead2026/);
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

test('CLI binary runs --version, --help, doctor --json, calc --json, and verify --json cleanly', () => {
  const ver = execFileSync(process.execPath, [CLI_PATH, '--version'], { encoding: 'utf8' });
  assert.match(ver, /flop-kit v1\.0\.0/);

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
