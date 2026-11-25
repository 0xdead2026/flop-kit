/**
 * Zero-dependency Local Mission Control Web Dashboard (127.0.0.1 only).
 * Serves a self-contained dark-mode telemetry, unlock simulator, command builder,
 * and anti-phishing verifier directly from Node's built-in http module.
 */
import http from 'node:http';
import { c, drawBox } from '../ansi.js';
import { BRANDING } from '../branding.js';
import { NETWORKS, OFFICIAL_CLI, OFFICIAL_LINKS } from '../constants.js';
import { t } from '../i18n.js';
import { fetchFullTelemetry } from '../rpc.js';
import { collectSystemReport } from './doctor.js';
import { classifyUrl } from './verify.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDashboardHtml() {
  const brandJson = JSON.stringify({
    toolName: BRANDING.toolName,
    version: BRANDING.version,
    githubUser: BRANDING.githubUser,
    xHandle: BRANDING.xHandle,
    repoUrl: BRANDING.repoUrl,
    xUrl: BRANDING.xUrl,
    cliPackage: OFFICIAL_CLI.cliPackage,
    testnetGenesis: NETWORKS.testnet.expectedGenesis,
    links: OFFICIAL_LINKS,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(BRANDING.toolName)} v${escapeHtml(BRANDING.version)} — FLOP Network Mission Control</title>
<style>
  :root {
    --bg: #070b14;
    --panel: #0e1627;
    --panel-2: #121d33;
    --border: rgba(56, 189, 248, 0.22);
    --text: #e2e8f0;
    --muted: #94a3b8;
    --cyan: #22d3ee;
    --green: #34d399;
    --yellow: #fbbf24;
    --red: #f87171;
    --magenta: #c084fc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: radial-gradient(circle at top right, rgba(34,211,238,0.12), transparent 42%),
                radial-gradient(circle at bottom left, rgba(192,132,252,0.10), transparent 42%),
                var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 24px;
  }
  .wrap { max-width: 1180px; margin: 0 auto; }
  header {
    display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;
    background: linear-gradient(135deg, rgba(14,22,39,0.95), rgba(18,29,51,0.9));
    border: 1px solid var(--border); border-radius: 16px; padding: 18px 22px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.45);
  }
  .brand h1 { margin: 0; font-size: 1.45rem; letter-spacing: 0.04em; color: var(--cyan); }
  .brand p { margin: 4px 0 0; color: var(--muted); font-size: 0.88rem; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .pill {
    font-size: 0.78rem; padding: 6px 12px; border-radius: 999px;
    background: rgba(34,211,238,0.1); border: 1px solid var(--border); color: var(--cyan);
    text-decoration: none; font-weight: 600; cursor: pointer;
  }
  .pill.warn { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.4); color: var(--yellow); }
  .pill.green { background: rgba(52,211,153,0.12); border-color: rgba(52,211,153,0.4); color: var(--green); }
  .banner {
    margin-top: 16px; padding: 14px 18px; border-radius: 12px;
    background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.35);
    color: #fde68a; font-size: 0.9rem; line-height: 1.45;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 16px; margin-top: 16px; }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px; box-shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
  .card h2 {
    margin: 0 0 12px; font-size: 1rem; color: var(--cyan);
    display: flex; justify-content: space-between; align-items: center;
  }
  .kv { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(148,163,184,0.12); font-size: 0.88rem; }
  .kv:last-child { border-bottom: none; }
  .kv .k { color: var(--muted); }
  .kv .v { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: right; word-break: break-word; overflow-wrap: anywhere; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; }
  .b-ok { background: rgba(52,211,153,0.16); color: var(--green); }
  .b-warn { background: rgba(251,191,36,0.16); color: var(--yellow); }
  .b-err { background: rgba(248,113,113,0.18); color: var(--red); }
  .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
  .tab {
    flex: 1; padding: 8px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--panel-2); color: var(--muted); font-weight: 600; cursor: pointer;
  }
  .tab.active { background: rgba(34,211,238,0.18); color: var(--cyan); border-color: var(--cyan); }
  input[type="number"], input[type="text"], select {
    width: 100%; padding: 10px 12px; border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.28); background: #09101f; color: var(--text);
    font-family: ui-monospace, monospace; font-size: 0.9rem; margin-bottom: 10px;
  }
  .bar-track { height: 14px; border-radius: 999px; background: #1e293b; overflow: hidden; display: flex; margin: 10px 0; }
  .bar-liq { background: linear-gradient(90deg, #10b981, #34d399); }
  .bar-lock { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
  pre {
    margin: 8px 0; padding: 12px; border-radius: 10px; background: #050911;
    border: 1px solid rgba(148,163,184,0.18); color: #67e8f9; overflow-x: auto;
    font-size: 0.8rem; line-height: 1.45;
  }
  button.action {
    padding: 8px 14px; border-radius: 8px; border: 1px solid var(--cyan);
    background: rgba(34,211,238,0.14); color: var(--cyan); font-weight: 700; cursor: pointer;
  }
  button.action:hover { background: rgba(34,211,238,0.26); }
  footer { margin-top: 20px; text-align: center; color: var(--muted); font-size: 0.8rem; }
  footer a { color: var(--cyan); text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <h1>FLOP-KIT v${escapeHtml(BRANDING.version)} · MISSION CONTROL</h1>
      <p id="subtitle">Zero-Dependency FLOP Network Testnet Cockpit &amp; Live Telemetry</p>
    </div>
    <div class="pills">
      <span class="pill green">0 Dependencies · Local 127.0.0.1</span>
      <a class="pill warn" href="/terminal">Terminal View</a>
      <button class="pill" id="refreshBtn">↻ Refresh</button>
      <a class="pill" href="${escapeHtml(BRANDING.repoUrl)}" target="_blank" rel="noreferrer">GitHub</a>
      <a class="pill" href="${escapeHtml(BRANDING.xUrl)}" target="_blank" rel="noreferrer">${escapeHtml(BRANDING.xHandle)}</a>
    </div>
  </header>

  <div class="banner" id="unscoredBanner">⚠ UNSCORED OPENING NOTICE: Early Testnet activity earns ZERO until the publicly announced activation block (no backfill). Official FLOP Labs has NO Discord, Telegram, Reddit, or Medium.</div>

  <div class="grid">
    <section class="card">
      <h2><span id="tTestnet">FLOP Public Testnet</span><span id="testnetBadge" class="badge b-warn">LOADING</span></h2>
      <div id="testnetBody"></div>
    </section>

    <section class="card">
      <h2><span id="tDevnet">FLOP Devnet & Faucet Probe</span><span id="faucetBadge" class="badge b-warn">LOADING</span></h2>
      <div id="devnetBody"></div>
    </section>

    <section class="card">
      <h2><span id="tDoctor">Local Hardware & Role Readiness</span><span id="doctorBadge" class="badge b-ok">LOCAL</span></h2>
      <div id="doctorBody"></div>
    </section>
  </div>

  <div class="grid">
    <section class="card">
      <h2 id="tCalc">Airdrop & Unlock Math Simulator</h2>
      <div class="tabs">
        <button class="tab active" data-role="agent">Agent (3:1)</button>
        <button class="tab" data-role="miner">Miner (25/75)</button>
        <button class="tab" data-role="validator">Validator (10y)</button>
      </div>
      <label id="calcLabel" style="font-size:0.82rem;color:var(--muted);display:block;margin-bottom:4px;"></label>
      <input type="number" id="calcInput" value="10000" min="1" />
      <div class="bar-track"><div class="bar-liq" id="barLiq"></div><div class="bar-lock" id="barLock"></div></div>
      <div id="calcResults"></div>
    </section>

    <section class="card">
      <h2 id="tVerify">Official Domain & Anti-Phishing Verifier</h2>
      <input type="text" id="verifyInput" placeholder="https://flop.finance or discord.gg/fake-flop" />
      <button class="action" id="verifyBtn">Verify URL</button>
      <div id="verifyResult" style="margin-top:12px;"></div>
    </section>
  </div>

  <section class="card" style="margin-top:16px;">
    <h2><span id="tCmd">Official CLI Command Builder ($0 Agent Flow)</span><button class="action" id="copyBtn">Copy</button></h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <select id="cmdNet">
        <option value="devnet">devnet (practice today — 0 airdrop weight)</option>
        <option value="testnet">testnet (use once scored activation block & miners open)</option>
      </select>
      <input type="text" id="cmdCap" value="0.01" placeholder="max-flop cap" />
    </div>
    <pre id="cmdPreview"></pre>
  </section>

  <footer>
    Built with <strong>${escapeHtml(BRANDING.toolName)}</strong> · Zero external dependencies · Official domains only:
    <a href="${escapeHtml(OFFICIAL_LINKS.website)}" target="_blank">flop.finance</a> ·
    <a href="${escapeHtml(OFFICIAL_LINKS.docs)}" target="_blank">docs.flop.network</a> ·
    <a href="${escapeHtml(OFFICIAL_LINKS.explorerTestnet)}" target="_blank">testnet.flopscan.io</a> ·
    <a href="${escapeHtml(OFFICIAL_LINKS.xOfficial)}" target="_blank">@flop_labs</a>
  </footer>
</div>

<script>
const CFG = ${brandJson};
let calcRole = 'agent';

const TEXT = {
  calcLabelAgent: 'Estimated Agent $FLOP Allocation:',
  calcLabelMiner: 'Estimated Miner $FLOP Allocation:',
  calcLabelVal: 'Number of Mainnet Validator Seats (1.2M $FLOP each):',
  copyBtn: 'Copy Command',
  copied: 'Copied!',
};

function fmt(n) { return (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US'); }
function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }

function updateCalc() {
  const val = Math.max(0, Number(document.getElementById('calcInput').value) || 0);
  const label = document.getElementById('calcLabel');
  let html = '', liqPct = 0;

  if (calcRole === 'agent') {
    label.textContent = TEXT.calcLabelAgent;
    const burn = val * 0.75;
    const liq = val * 0.25;
    liqPct = 25;
    html =
      kv('TGE Liquid', '<span class="badge b-err">0 $FLOP (0%)</span>') +
      kv('Consumed on Mainnet Inference (75%)', fmt(burn) + ' $FLOP') +
      kv('Max Liquid Unlocked (3:1 rule, 25%)', '<strong style="color:var(--green)">' + fmt(liq) + ' $FLOP</strong>');
  } else if (calcRole === 'miner') {
    label.textContent = TEXT.calcLabelMiner;
    const tge = val * 0.25;
    const locked = val * 0.75;
    liqPct = 25;
    html =
      kv('Liquid at Genesis (25%)', '<strong style="color:var(--green)">' + fmt(tge) + ' $FLOP</strong>') +
      kv('Locked (1:1 earn-to-unlock, 75%)', fmt(locked) + ' $FLOP') +
      kv('Usable as Mainnet Miner Stake', '<span class="badge b-ok">YES</span>');
  } else {
    label.textContent = TEXT.calcLabelVal;
    const seats = Math.max(1, Math.floor(val || 1));
    const total = seats * 1200000;
    liqPct = 0;
    html =
      kv('Fixed Bond Allocation', fmt(total) + ' $FLOP') +
      kv('Liquid at TGE', '<span class="badge b-err">0 $FLOP (Bonded)</span>') +
      kv('Unlock Schedule', '~10 years (5 halvings · ' + fmt(total / 10) + '/yr linear)');
  }
  document.getElementById('barLiq').style.width = liqPct + '%';
  document.getElementById('barLock').style.width = (100 - liqPct) + '%';
  document.getElementById('calcResults').innerHTML = html;
}

function updateCmd() {
  const net = document.getElementById('cmdNet').value;
  const cap = document.getElementById('cmdCap').value || '0.01';
  const lines = [
    'npx --yes --package ' + CFG.cliPackage + ' flop \\\\',
    '  --network ' + net + ' \\\\',
    '  --keystore ~/.flop-kit/keys/agent-' + net + '.json \\\\',
    '  --password-env FLOP_KEY_PASSWORD \\\\',
    '  session run \\\\',
    '  --miner "<MINER_SS58>" \\\\',
    '  --model qwen/qwen2.5-0.5b-instruct \\\\',
    '  --prompt "Verify Proof of Useful Inference." \\\\',
    '  --max-flop ' + cap + ' --via auto --json'
  ];
  document.getElementById('cmdPreview').textContent = lines.join(String.fromCharCode(10));
}

async function loadTelemetry() {
  try {
    const res = await fetch('/api/telemetry');
    const data = await res.json();
    const tn = data.testnet;
    const tnBadge = document.getElementById('testnetBadge');
    if (tn.ok) {
      tnBadge.className = 'badge ' + (tn.genesisVerified ? 'b-ok' : 'b-err');
      tnBadge.textContent = tn.genesisVerified ? 'GENESIS VERIFIED' : 'GENESIS MISMATCH';
      document.getElementById('testnetBody').innerHTML =
        kv('Chain', tn.chainName) +
        kv('Best Block', '#' + fmt(tn.bestBlock)) +
        kv('Finalized Block', '#' + fmt(tn.finalizedBlock)) +
        kv('Runtime Spec', (tn.specName || 'flop') + ' v' + tn.specVersion) +
        kv('RPC Peers / Latency', fmt(tn.peers) + ' / ' + tn.latencyMs + 'ms') +
        kv('Genesis', tn.genesisHash.slice(0, 14) + '…' + tn.genesisHash.slice(-8));
    } else {
      tnBadge.className = 'badge b-err';
      tnBadge.textContent = 'OFFLINE';
      document.getElementById('testnetBody').innerHTML = kv('Error', tn.error);
    }

    const dn = data.devnet;
    const fc = data.faucet;
    const fcBadge = document.getElementById('faucetBadge');
    fcBadge.className = 'badge ' + (fc.detectedTarget === 'testnet' && fc.faucetStatus === 'open' ? 'b-ok' : 'b-warn');
    fcBadge.textContent = 'FAUCET: ' + String(fc.detectedTarget).toUpperCase() + (fc.faucetStatus ? ' · ' + String(fc.faucetStatus).toUpperCase() : '');
    document.getElementById('devnetBody').innerHTML =
      kv('Devnet Block', dn.ok ? '#' + fmt(dn.bestBlock) + ' (v' + dn.specVersion + ')' : 'OFFLINE') +
      kv('Faucet Target', '<span class="badge ' + (fc.detectedTarget === 'testnet' ? 'b-ok' : 'b-warn') + '">' + fc.detectedTarget + '</span>' + (fc.genesisVerified ? ' <span class="badge b-ok">GENESIS OK</span>' : '')) +
      kv('Agent Grant', fc.agentGrantFlop ? fc.agentGrantFlop + ' FLOP / 24h (' + (fc.claimPath || '/v1/testnet/agent-claims') + ')' : '—') +
      kv('Pending Queue / Daily Left', (fc.pendingGrants !== null && fc.pendingGrants !== undefined ? fmt(fc.pendingGrants) : '—') + ' / ' + (fc.dailyRemainingFlop ? fmt(fc.dailyRemainingFlop) + ' FLOP' : '—')) +
      kv('Last Checked', new Date(data.checkedAt).toLocaleTimeString());
  } catch (e) {
    document.getElementById('testnetBody').innerHTML = kv('Fetch Error', e.message);
  }
}

async function loadDoctor() {
  try {
    const res = await fetch('/api/doctor');
    const r = await res.json();
    const gpus = r.hardware.gpus.length ? r.hardware.gpus.map(g => g.name + ' (' + g.vramGb + 'GB)').join(', ') : 'None';
    document.getElementById('doctorBody').innerHTML =
      kv('Node.js', r.node.version + (r.node.ok ? ' <span class="badge b-ok">OK</span>' : ' <span class="badge b-err">OLD</span>')) +
      kv('CPU / RAM', r.hardware.cpuCores + ' cores · ' + r.hardware.ramGb + ' GB') +
      kv('Free Disk', r.hardware.freeDiskGb !== null ? r.hardware.freeDiskGb + ' GB' : '—') +
      kv('NVIDIA GPU', gpus) +
      kv('$0 Agent Ready', r.roles.agent ? '<span class="badge b-ok">READY</span>' : '<span class="badge b-err">NO</span>') +
      kv('Validator / Miner', (r.roles.validatorProduction ? '<span class="badge b-ok">VAL</span>' : '<span class="badge b-warn">NO VAL</span>') + ' / ' + (r.roles.miner ? '<span class="badge b-ok">MINER</span>' : '<span class="badge b-warn">NO GPU</span>'));
  } catch (e) {
    document.getElementById('doctorBody').innerHTML = kv('Error', e.message);
  }
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    calcRole = btn.dataset.role;
    document.getElementById('calcInput').value = calcRole === 'validator' ? 1 : 10000;
    updateCalc();
  });
});

document.getElementById('calcInput').addEventListener('input', updateCalc);
document.getElementById('cmdNet').addEventListener('change', updateCmd);
document.getElementById('cmdCap').addEventListener('input', updateCmd);
document.getElementById('refreshBtn').addEventListener('click', () => { loadTelemetry(); loadDoctor(); });
document.getElementById('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('cmdPreview').textContent);
  document.getElementById('copyBtn').textContent = TEXT.copied;
  setTimeout(() => { document.getElementById('copyBtn').textContent = TEXT.copyBtn; }, 1500);
});
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const u = document.getElementById('verifyInput').value.trim();
  if (!u) return;
  const res = await fetch('/api/verify?url=' + encodeURIComponent(u));
  const data = await res.json();
  const cls = data.status === 'official' ? 'b-ok' : (data.status === 'scam_channel' || data.status === 'suspicious_lookalike' ? 'b-err' : 'b-warn');
  document.getElementById('verifyResult').innerHTML =
    kv('Verdict', '<span class="badge ' + cls + '">' + String(data.status).toUpperCase() + '</span>') +
    kv('Detail', data.reason || '');
});

document.getElementById('copyBtn').textContent = TEXT.copyBtn;
updateCalc();
updateCmd();
loadTelemetry();
loadDoctor();
setInterval(loadTelemetry, 20000);
</script>
</body>
</html>`;
}

export function renderTerminalShowcaseHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(BRANDING.toolName)} — Terminal Cockpit Preview</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 16px 24px;
    background: radial-gradient(circle at 20% 15%, rgba(34,211,238,0.18), transparent 45%),
                radial-gradient(circle at 80% 85%, rgba(192,132,252,0.16), transparent 45%),
                #04070f;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #e2e8f0;
  }
  .controls { margin-bottom: 10px; display: flex; gap: 10px; }
  .btn {
    padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(56,189,248,0.35);
    background: rgba(14,22,39,0.9); color: #22d3ee; text-decoration: none;
    font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  }
  .window {
    width: 100%; max-width: 920px; border-radius: 16px; overflow: hidden;
    background: #0a101f; border: 1px solid rgba(56,189,248,0.32);
    box-shadow: 0 28px 80px rgba(0,0,0,0.75), 0 0 40px rgba(34,211,238,0.12);
  }
  .titlebar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; background: #10192e; border-bottom: 1px solid rgba(148,163,184,0.14);
  }
  .dots { display: flex; gap: 8px; }
  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .d-r { background: #ef4444; } .d-y { background: #f59e0b; } .d-g { background: #10b981; }
  .tb-title { color: #94a3b8; font-size: 0.8rem; }
  .screen { padding: 16px 22px; font-size: 0.82rem; line-height: 1.42; }
  .logo { color: #22d3ee; white-space: pre; font-weight: 700; margin: 0 0 8px; font-size: 0.78rem; line-height: 1.14; }
  .meta { color: #cbd5e1; margin-bottom: 4px; }
  .live { color: #34d399; margin-bottom: 10px; font-size: 0.81rem; }
  .box { border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; }
  .box-warn { border: 1px solid rgba(251,191,36,0.55); background: rgba(251,191,36,0.06); color: #fde68a; }
  .box-menu { border: 1px solid rgba(34,211,238,0.45); background: rgba(15,23,42,0.7); }
  .box-title { font-weight: 700; margin-bottom: 6px; letter-spacing: 0.03em; }
  .item { padding: 2px 6px; border-radius: 6px; }
  .item.active { background: rgba(34,211,238,0.16); color: #22d3ee; font-weight: 700; }
  .muted { color: #64748b; }
  .cyan { color: #22d3ee; }
  .mag { color: #c084fc; }
  .yel { color: #fbbf24; }
  .grn { color: #34d399; }
</style>
</head>
<body>
  <div class="controls">
    <a class="btn" href="/">← Mission Control Dashboard</a>
  </div>
  <div class="window">
    <div class="titlebar">
      <div class="dots"><span class="dot d-r"></span><span class="dot d-y"></span><span class="dot d-g"></span></div>
      <div class="tb-title">${escapeHtml(BRANDING.toolName)} v${escapeHtml(BRANDING.version)} — node bin/flop-kit.js</div>
      <div class="tb-title" style="color:#34d399;">0 Dependencies</div>
    </div>
    <div class="screen">
<pre class="logo">  ███████╗██╗      ██████╗ ██████╗       ██╗  ██╗██╗████████╗
  ██╔════╝██║     ██╔═══██╗██╔══██╗      ██║ ██╔╝██║╚══██╔══╝
  █████╗  ██║     ██║   ██║██████╔╝█████╗█████╔╝ ██║   ██║
  ██╔══╝  ██║     ██║   ██║██╔═══╝ ╚════╝██╔═██╗ ██║   ██║
  ██║     ███████╗╚██████╔╝██║           ██║  ██╗██║   ██║
  ╚═╝     ╚══════╝ ╚═════╝ ╚═╝           ╚═╝  ╚═╝╚═╝   ╚═╝</pre>
      <div class="meta"><strong>${escapeHtml(BRANDING.toolName)} v${escapeHtml(BRANDING.version)}</strong> · <span id="tagline" class="cyan"></span></div>
      <div class="meta"><span class="muted">GitHub:</span> ${escapeHtml(BRANDING.repoUrl)}  ·  <span class="muted">X:</span> <span class="mag">${escapeHtml(BRANDING.xHandle)}</span></div>
      <div class="live" id="liveBar">Connecting to live FLOP Testnet RPC...</div>

      <div class="box box-warn">
        <div class="box-title" id="warnTitle"></div>
        <div id="warnBody"></div>
      </div>

      <div class="box box-menu">
        <div class="box-title cyan" id="menuTitle"></div>
        <div id="menuBody"></div>
      </div>
      <div class="muted" id="footerHint"></div>
    </div>
  </div>
<script>
const COPY = {
  tagline: 'Zero-Dependency FLOP Network Testnet Cockpit & Mission Control',
  warnTitle: '⚠ SECURITY & TESTNET REALITY CHECK',
  warnLines: [
    '• Zero external dependencies (0 npm packages) — every line is locally auditable.',
    '• NEVER asks for seed phrases, private keys, or real mainnet funds.',
    '• Opening phase is UNSCORED until the announced activation block (no backfill).',
    '• NO official FLOP Discord, Telegram, Reddit, or Medium exists — watch out for scams.'
  ],
  menuTitle: 'MAIN CONTROL MENU',
  items: [
    '[1] ◈  Live Network Status & Genesis Check (Testnet + Devnet)',
    '[2] ✦  Signed Testnet Faucet Claim (10 $FLOP / 24h · Official Protocol)',
    '[3] ◉  Activation Sniper (Watch Runtime Upgrade & Faucet Switch)',
    '[4] ✚  System Doctor & Role Eligibility Audit (CPU / RAM / GPU)',
    '[5] ▶  $0 Agent Hub (Keystore, Official session run, Hermes, Faucet)',
    '[6] ◆  Validator Prep & Devnet Rehearsal Receipt Generator',
    '[7] ▲  Miner Hardware Readiness (NVIDIA 16GB+ VRAM & Docker)',
    '[8] ∑  Airdrop & Unlock Math Simulator (3:1 Agent / Miner / Validator)',
    '[9] ◎  Official Domain & Anti-Phishing URL Verifier',
    '[d] ⊞  Launch Local Mission Control Web Dashboard (127.0.0.1)',
    '[0] ✕  Exit flop-kit'
  ],
  hint: 'Use ↑/↓ arrows (or 1-9) + Enter · [L] Language · [Q] Quit'
};
function render() {
  document.getElementById('tagline').textContent = COPY.tagline;
  document.getElementById('warnTitle').textContent = COPY.warnTitle;
  document.getElementById('warnBody').innerHTML = COPY.warnLines.map(l => '<div>' + l + '</div>').join('');
  document.getElementById('menuTitle').textContent = COPY.menuTitle;
  document.getElementById('menuBody').innerHTML = COPY.items.map((l, i) => '<div class="item' + (i === 0 ? ' active' : '') + '">' + (i === 0 ? '▸ ' : '  ') + l + '</div>').join('');
  document.getElementById('footerHint').textContent = COPY.hint;
}
async function loadLive() {
  try {
    const r = await fetch('/api/telemetry');
    const data = await r.json();
    const tn = data.testnet;
    const fc = data.faucet;
    if (tn && tn.ok) {
      document.getElementById('liveBar').innerHTML =
        '<span class="cyan">Testnet #' + Number(tn.bestBlock).toLocaleString('en-US') + ' (v' + tn.specVersion + ')</span> ' +
        '<span class="grn">✓ Genesis Verified</span> · ' +
        '<span class="yel">Faucet: ' + String(fc.detectedTarget || '?').toUpperCase() + '</span> · ' +
        '<span class="yel">Phase: UNSCORED</span>';
    }
  } catch {}
}
render();
loadLive();
</script>
</body>
</html>`;
}

export function createDashboardServer(lang = 'en') {
  return http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (parsedUrl.pathname === '/api/telemetry') {
      const data = await fetchFullTelemetry();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }

    if (parsedUrl.pathname === '/api/doctor') {
      const rep = collectSystemReport();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(rep));
      return;
    }

    if (parsedUrl.pathname === '/api/verify') {
      const target = parsedUrl.searchParams.get('url') || '';
      const result = classifyUrl(target);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (parsedUrl.pathname === '/terminal') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderTerminalShowcaseHtml());
      return;
    }

    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderDashboardHtml());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

export async function runDashboard(lang = 'en', options = {}) {
  const port = Number(options.port) || 4141;
  const host = '127.0.0.1';
  console.log(c.dim(t(lang, 'dashboard.starting')));

  const server = createDashboardServer(lang);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const url = `http://${host}:${actualPort}`;

  console.log('');
  console.log(
    drawBox(
      'FLOP-KIT LOCAL MISSION CONTROL',
      [
        c.brightGreen(t(lang, 'dashboard.running', { url })),
        c.gray(t(lang, 'dashboard.hint')),
        c.gray('Bound strictly to 127.0.0.1 (local machine only — never exposed externally).'),
      ],
      { borderColor: c.cyan }
    )
  );

  if (options.returnServer) {
    return { server, url, port: actualPort };
  }

  await new Promise((resolve) => {
    const shutdown = () => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
