#!/usr/bin/env node
/**
 * flop-kit — Zero-dependency, bilingual (EN/TR) interactive CLI cockpit,
 * live activation watcher, and local Mission Control dashboard for FLOP Network.
 */
import { c, drawBox } from '../src/ansi.js';
import { BRANDING } from '../src/branding.js';
import { detectDefaultLang } from '../src/i18n.js';
import { runAgentHub } from '../src/modules/agent.js';
import { runCalculator } from '../src/modules/calculator.js';
import { runDashboard } from '../src/modules/dashboard.js';
import { runDoctor } from '../src/modules/doctor.js';
import { runMinerModule } from '../src/modules/miner.js';
import { runStatus } from '../src/modules/status.js';
import { runValidatorModule } from '../src/modules/validator.js';
import { runVerifyModule } from '../src/modules/verify.js';
import { runWatch } from '../src/modules/watch.js';
import { renderStaticPreview, runInteractiveTui } from '../src/tui.js';

export function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    lang: null,
    json: false,
    help: false,
    version: false,
    once: false,
    interval: 15,
    port: 4141,
    role: null,
    amount: null,
  };
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--version' || a === '-v') flags.version = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--once') flags.once = true;
    else if (a === '--lang' || a === '-l') flags.lang = args[++i];
    else if (a.startsWith('--lang=')) flags.lang = a.split('=')[1];
    else if (a === '--interval') flags.interval = Number(args[++i]) || 15;
    else if (a === '--port') flags.port = Number(args[++i]) || 4141;
    else if (a === '--role') flags.role = args[++i];
    else if (a === '--amount') flags.amount = Number(args[++i]);
    else positional.push(a);
  }

  return {
    command: (positional[0] || '').toLowerCase(),
    rest: positional.slice(1),
    flags,
  };
}

function printHelp(lang) {
  const isTr = lang === 'tr';
  const lines = [
    `${c.bold(BRANDING.toolName)} v${BRANDING.version} — ${isTr ? BRANDING.taglineTr : BRANDING.taglineEn}`,
    `${c.gray('GitHub:')} ${BRANDING.repoUrl}  |  ${c.gray('X:')} ${BRANDING.xHandle}`,
    '',
    c.bold(isTr ? 'Kullanım:' : 'Usage:'),
    '  node bin/flop-kit.js [command] [options]',
    '',
    c.bold(isTr ? 'Komutlar:' : 'Commands:'),
    `  ${c.cyan('(no args)')}     ${isTr ? 'Etkileşimli Terminal Kokpitini aç (↑/↓ + EN/TR)' : 'Launch Interactive Terminal Cockpit (↑/↓ + EN/TR)'}`,
    `  ${c.cyan('status')}        ${isTr ? 'Canlı Testnet/Devnet blok, genesis ve faucet kontrolü' : 'Live Testnet/Devnet block, genesis, and faucet check'}`,
    `  ${c.cyan('watch')}         ${isTr ? 'Aktivasyon takipçisi (runtime yükseltme & faucet alarmı)' : 'Activation sniper (watch runtime upgrade & faucet switch)'}`,
    `  ${c.cyan('doctor')}        ${isTr ? 'Sistem, Node, Docker, GPU ve rol uygunluk analizi' : 'System, Node, Docker, GPU & role eligibility audit'}`,
    `  ${c.cyan('agent')}         ${isTr ? '$0 Agent merkezi (resmi session run, keystore, Hermes)' : '$0 Agent hub (official session run, keystore, Hermes)'}`,
    `  ${c.cyan('validator')}     ${isTr ? 'Validator hazırlık & GitHub gözlem kanıtı şablonu' : 'Validator prep & GitHub observation receipt generator'}`,
    `  ${c.cyan('miner')}         ${isTr ? 'Miner NVIDIA 16GB+ VRAM & Docker kontrolü' : 'Miner NVIDIA 16GB+ VRAM & Docker readiness check'}`,
    `  ${c.cyan('calc')}          ${isTr ? 'Airdrop & kilit açılım hesaplayıcı (--role agent|miner|validator --amount N)' : 'Airdrop & unlock math simulator (--role agent|miner|validator --amount N)'}`,
    `  ${c.cyan('verify [url]')}  ${isTr ? 'Resmi domain & phishing/sahte kanal doğrulayıcı' : 'Official domain & anti-phishing URL verifier'}`,
    `  ${c.cyan('dashboard')}     ${isTr ? 'Yerel Mission Control Web Panelini başlat (127.0.0.1:4141)' : 'Start Local Mission Control Web Dashboard (127.0.0.1:4141)'}`,
    '',
    c.bold(isTr ? 'Seçenekler:' : 'Options:'),
    '  --lang en|tr     Set display language (English or Turkish)',
    '  --json           Output machine-readable JSON (status, doctor, miner, calc, verify)',
    '  --interval <sec> Poll interval for watch (default: 15)',
    '  --port <port>    Localhost port for dashboard (default: 4141)',
    '  --version, -v    Print version',
    '  --help, -h       Show this help',
  ];
  console.log(drawBox(`${BRANDING.toolName} CLI`, lines, { borderColor: c.cyan }));
}

async function main() {
  const { command, rest, flags } = parseArgs(process.argv);
  const lang = flags.lang === 'tr' || flags.lang === 'en' ? flags.lang : detectDefaultLang();

  if (flags.version) {
    console.log(`${BRANDING.toolName} v${BRANDING.version}`);
    return;
  }

  if (flags.help || command === 'help') {
    printHelp(lang);
    return;
  }

  if (!command) {
    await runInteractiveTui(lang);
    return;
  }

  if (command === 'status') {
    await runStatus(lang, { json: flags.json });
  } else if (command === 'watch') {
    await runWatch(lang, { interval: flags.interval, once: flags.once });
  } else if (command === 'doctor') {
    runDoctor(lang, { json: flags.json });
  } else if (command === 'agent') {
    await runAgentHub(lang, { nonInteractive: !process.stdin.isTTY });
  } else if (command === 'validator') {
    await runValidatorModule(lang, { nonInteractive: !process.stdin.isTTY });
  } else if (command === 'miner') {
    runMinerModule(lang, { json: flags.json });
  } else if (command === 'calc') {
    await runCalculator(lang, {
      role: flags.role || rest[0],
      amount: flags.amount ?? (rest[1] ? Number(rest[1]) : undefined),
      json: flags.json,
    });
  } else if (command === 'verify') {
    await runVerifyModule(lang, { url: rest[0] || '', json: flags.json });
  } else if (command === 'dashboard' || command === 'ui') {
    await runDashboard(lang, { port: flags.port });
  } else if (command === 'preview') {
    await renderStaticPreview(lang);
  } else {
    console.error(c.red(`Unknown command: ${command}\n`));
    printHelp(lang);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(c.red(`Fatal error: ${err?.message || err}`));
  process.exitCode = 1;
});
