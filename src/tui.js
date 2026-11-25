/**
 * Interactive Terminal Cockpit (TUI) for flop-kit.
 * Supports arrow keys, number hotkeys (1-9, 0), live [L] EN/TR language toggle, and [Q] quit.
 */
import readline from 'node:readline';
import { askLine, badge, c, clearScreen, drawBox, formatNum } from './ansi.js';
import { BRANDING } from './branding.js';
import { MESSAGES, t } from './i18n.js';
import { fetchFullTelemetry } from './rpc.js';
import { runAgentHub } from './modules/agent.js';
import { runCalculator } from './modules/calculator.js';
import { runClaimModule } from './modules/claim.js';
import { runDashboard } from './modules/dashboard.js';
import { runDoctor } from './modules/doctor.js';
import { runMinerModule } from './modules/miner.js';
import { runStatus } from './modules/status.js';
import { runValidatorModule } from './modules/validator.js';
import { runVerifyModule } from './modules/verify.js';
import { runWatch } from './modules/watch.js';

const LOGO = [
  '  ███████╗██╗      ██████╗ ██████╗       ██╗  ██╗██╗████████╗',
  '  ██╔════╝██║     ██╔═══██╗██╔══██╗      ██║ ██╔╝██║╚══██╔══╝',
  '  █████╗  ██║     ██║   ██║██████╔╝█████╗█████╔╝ ██║   ██║   ',
  '  ██╔══╝  ██║     ██║   ██║██╔═══╝ ╚════╝██╔═██╗ ██║   ██║   ',
  '  ██║     ███████╗╚██████╔╝██║           ██║  ██╗██║   ██║   ',
  '  ╚═╝     ╚══════╝ ╚═════╝ ╚═╝           ╚═╝  ╚═╝╚═╝   ╚═╝   ',
];

const MENU_KEYS = [
  { id: 'status', icon: '◈', key: '1' },
  { id: 'claim', icon: '✦', key: '2' },
  { id: 'watch', icon: '◉', key: '3' },
  { id: 'doctor', icon: '✚', key: '4' },
  { id: 'agent', icon: '▶', key: '5' },
  { id: 'validator', icon: '◆', key: '6' },
  { id: 'miner', icon: '▲', key: '7' },
  { id: 'calc', icon: '∑', key: '8' },
  { id: 'verify', icon: '◎', key: '9' },
  { id: 'dashboard', icon: '⊞', key: 'd' },
  { id: 'exit', icon: '✕', key: '0' },
];

function formatLiveStrip(telemetry, lang) {
  if (!telemetry) {
    return c.gray(lang === 'tr' ? 'Canlı telemetri yükleniyor...' : 'Loading live telemetry...');
  }
  const tn = telemetry.testnet;
  const fc = telemetry.faucet;
  const tnPart = tn?.ok
    ? `Testnet #${formatNum(tn.bestBlock)} (v${tn.specVersion}) ${tn.genesisVerified ? c.brightGreen('✓Genesis') : c.red('✗Genesis')}`
    : c.red('Testnet Offline');
  const fcPart =
    fc?.detectedTarget === 'testnet'
      ? c.brightGreen('Faucet: TESTNET')
      : c.yellow(`Faucet: ${String(fc?.detectedTarget || '?').toUpperCase()}`);
  const phasePart = c.brightYellow('Phase: UNSCORED');
  return `${c.cyan(tnPart)}  ${c.gray('|')}  ${fcPart}  ${c.gray('|')}  ${phasePart}`;
}

function renderCockpit(lang, selectedIdx, telemetry) {
  clearScreen();
  const tagline = lang === 'tr' ? BRANDING.taglineTr : BRANDING.taglineEn;

  console.log(c.brightCyan(LOGO.join('\n')));
  console.log(
    `  ${c.bold(c.white(`${BRANDING.toolName} v${BRANDING.version}`))}  ${c.gray('·')}  ${c.cyan(tagline)}`
  );
  console.log(
    `  ${c.gray('GitHub:')} ${c.white(BRANDING.repoUrl)}  ${c.gray('·  X:')} ${c.white(BRANDING.xHandle)}  ${c.gray('·')}  ${badge(t(lang, 'langSwitchHint'), 'magenta')}`
  );
  console.log(`  ${formatLiveStrip(telemetry, lang)}\n`);

  const bannerLines = (MESSAGES[lang] || MESSAGES.en).securityBannerLines.map((l) => c.yellow(l));
  console.log(
    drawBox(t(lang, 'securityBannerTitle'), bannerLines, {
      borderColor: c.yellow,
      titleColor: (s) => c.bold(c.brightYellow(s)),
    })
  );
  console.log('');

  const menuLines = MENU_KEYS.map((item, idx) => {
    const label = t(lang, `menu.${item.id}`);
    const prefix = idx === selectedIdx ? c.brightCyan(' ▸ ') : '   ';
    const num = c.gray(`[${item.key}]`);
    const text = idx === selectedIdx ? c.bold(c.brightCyan(label)) : c.white(label);
    return `${prefix}${num} ${item.icon}  ${text}`;
  });

  console.log(
    drawBox(
      lang === 'tr' ? 'ANA KONTROL MENÜSÜ' : 'MAIN CONTROL MENU',
      menuLines,
      { borderColor: c.cyan }
    )
  );
  console.log(`\n  ${c.gray(t(lang, 'chooseOption'))}`);
}

function waitForMenuKey(lang, selectedIdx, telemetry) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      askLine('\nSelect [0-9 / L / Q]: ').then((val) => {
        const lower = val.toLowerCase();
        if (lower === 'l') return resolve({ type: 'lang' });
        if (lower === 'q' || lower === '0' || lower === '') return resolve({ type: 'select', index: MENU_KEYS.length - 1 });
        const idx = MENU_KEYS.findIndex((m) => m.key === lower);
        return resolve({ type: 'select', index: idx >= 0 ? idx : selectedIdx });
      });
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let current = selectedIdx;

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKey);
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore if already restored
      }
    };

    const onKey = (str, key) => {
      if (key?.ctrl && key?.name === 'c') {
        cleanup();
        resolve({ type: 'quit' });
        return;
      }
      if (key?.name === 'up' || str === 'k') {
        current = (current - 1 + MENU_KEYS.length) % MENU_KEYS.length;
        renderCockpit(lang, current, telemetry);
        return;
      }
      if (key?.name === 'down' || str === 'j') {
        current = (current + 1) % MENU_KEYS.length;
        renderCockpit(lang, current, telemetry);
        return;
      }
      if (key?.name === 'return') {
        cleanup();
        resolve({ type: 'select', index: current });
        return;
      }
      if (str && str.toLowerCase() === 'l') {
        cleanup();
        resolve({ type: 'lang', index: current });
        return;
      }
      if (str && (str.toLowerCase() === 'q' || key?.name === 'escape')) {
        cleanup();
        resolve({ type: 'quit' });
        return;
      }
      const directIdx = MENU_KEYS.findIndex((m) => m.key === str);
      if (directIdx >= 0) {
        cleanup();
        resolve({ type: 'select', index: directIdx });
      }
    };

    process.stdin.on('keypress', onKey);
  });
}

export async function renderStaticPreview(lang = 'en') {
  let telemetry = null;
  try {
    telemetry = await fetchFullTelemetry();
  } catch {
    telemetry = null;
  }
  renderCockpit(lang, 0, telemetry);
}

export async function runInteractiveTui(initialLang = 'en') {
  let lang = initialLang;
  let selectedIdx = 0;

  let telemetry = null;
  try {
    telemetry = await fetchFullTelemetry();
  } catch {
    telemetry = null;
  }

  while (true) {
    renderCockpit(lang, selectedIdx, telemetry);
    const evt = await waitForMenuKey(lang, selectedIdx, telemetry);

    if (evt.type === 'quit') {
      console.log('\n' + c.cyan(t(lang, 'goodbye')));
      break;
    }

    if (evt.type === 'lang') {
      lang = lang === 'en' ? 'tr' : 'en';
      selectedIdx = evt.index ?? selectedIdx;
      continue;
    }

    selectedIdx = evt.index ?? 0;
    const picked = MENU_KEYS[selectedIdx];
    if (!picked || picked.id === 'exit') {
      console.log('\n' + c.cyan(t(lang, 'goodbye')));
      break;
    }

    clearScreen();
    try {
      if (picked.id === 'status') {
        telemetry = await runStatus(lang);
      } else if (picked.id === 'claim') {
        await runClaimModule(lang);
      } else if (picked.id === 'watch') {
        await runWatch(lang);
      } else if (picked.id === 'doctor') {
        runDoctor(lang);
      } else if (picked.id === 'agent') {
        await runAgentHub(lang);
      } else if (picked.id === 'validator') {
        await runValidatorModule(lang);
      } else if (picked.id === 'miner') {
        runMinerModule(lang);
      } else if (picked.id === 'calc') {
        await runCalculator(lang);
      } else if (picked.id === 'verify') {
        await runVerifyModule(lang);
      } else if (picked.id === 'dashboard') {
        await runDashboard(lang);
      }
    } catch (err) {
      console.error(c.red(`\nError: ${err?.message || err}`));
    }

    await askLine('\n' + c.gray(t(lang, 'pressEnter')));
  }
}
