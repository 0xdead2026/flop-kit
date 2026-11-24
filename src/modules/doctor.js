/**
 * System Doctor & Hardware Eligibility Audit for FLOP Network roles.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { badge, c, drawBox } from '../ansi.js';
import { HARDWARE_SPECS, OFFICIAL_CLI } from '../constants.js';
import { t } from '../i18n.js';

function tryCommand(cmd, args = ['--version'], isWindowsCmdShim = false) {
  const execName =
    process.platform === 'win32' && isWindowsCmdShim ? 'cmd.exe' : cmd;
  const execArgs =
    process.platform === 'win32' && isWindowsCmdShim
      ? ['/d', '/s', '/c', cmd, ...args]
      : args;

  try {
    const out = execFileSync(execName, execArgs, {
      encoding: 'utf8',
      timeout: 12000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, output: out.trim().split(/\r?\n/)[0] || 'installed' };
  } catch {
    return { ok: false, output: null };
  }
}

export function detectNvidiaGpu() {
  try {
    const out = execFileSync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      {
        encoding: 'utf8',
        timeout: 6000,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      }
    ).trim();
    if (!out) return [];
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, memMbStr] = line.split(',').map((s) => s.trim());
        const vramGb = Math.round((Number(memMbStr) / 1024) * 10) / 10;
        return { name, vramGb: Number.isNaN(vramGb) ? 0 : vramGb };
      });
  } catch {
    return [];
  }
}

function getFreeDiskGb(targetDir = process.cwd()) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const st = fs.statfsSync(targetDir);
      return Math.round(((st.bavail * st.bsize) / 1024 ** 3) * 10) / 10;
    }
  } catch {
    // Ignore on platforms where statfsSync fails
  }
  return null;
}

export function collectSystemReport() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const npm = tryCommand('npm', ['--version'], true);
  const npx = tryCommand('npx', ['--version'], true);
  const docker = tryCommand('docker', ['--version']);
  const git = tryCommand('git', ['--version']);
  const globalFlop = tryCommand('flop', ['--version'], true);

  const cpus = os.cpus() || [];
  const cpuCores = cpus.length;
  const cpuModel = cpus[0]?.model?.trim() || 'Unknown CPU';
  const ramGb = Math.round((os.totalmem() / 1024 ** 3) * 10) / 10;
  const freeDiskGb = getFreeDiskGb();
  const gpus = detectNvidiaGpu();
  const maxVramGb = gpus.reduce((m, g) => Math.max(m, g.vramGb), 0);

  const isLinuxAmd64 = process.platform === 'linux' && process.arch === 'x64';

  const agentReady =
    nodeMajor >= OFFICIAL_CLI.minNodeMajor &&
    npm.ok &&
    ramGb >= HARDWARE_SPECS.agent.minRamGb;

  const valRehearsalReady =
    cpuCores >= HARDWARE_SPECS.validatorRehearsal.minCores &&
    ramGb >= HARDWARE_SPECS.validatorRehearsal.minRamGb &&
    docker.ok &&
    (freeDiskGb === null || freeDiskGb >= HARDWARE_SPECS.validatorRehearsal.minDiskGb);

  const valProdReady =
    isLinuxAmd64 &&
    nodeMajor >= OFFICIAL_CLI.validatorNodeMajor &&
    cpuCores >= HARDWARE_SPECS.validatorProduction.minCores &&
    ramGb >= HARDWARE_SPECS.validatorProduction.minRamGb &&
    docker.ok &&
    (freeDiskGb === null || freeDiskGb >= HARDWARE_SPECS.validatorProduction.minDiskGb);

  const minerReady =
    maxVramGb >= HARDWARE_SPECS.miner.minVramGb && docker.ok;

  return {
    os: `${os.platform()} ${os.arch()} (${os.release()})`,
    isLinuxAmd64,
    node: { version: process.version, major: nodeMajor, ok: nodeMajor >= OFFICIAL_CLI.minNodeMajor },
    npm,
    npx,
    docker,
    git,
    globalFlop,
    hardware: {
      cpuModel,
      cpuCores,
      ramGb,
      freeDiskGb,
      gpus,
      maxVramGb,
    },
    roles: {
      agent: agentReady,
      validatorRehearsal: valRehearsalReady,
      validatorProduction: valProdReady,
      miner: minerReady,
    },
    keysDir: path.join(os.homedir(), '.flop-kit', 'keys'),
  };
}

export function runDoctor(lang = 'en', options = {}) {
  const rep = collectSystemReport();

  if (options.json) {
    console.log(JSON.stringify(rep, null, 2));
    return rep;
  }

  const st = (ok, warn = false) =>
    ok
      ? badge(t(lang, 'doctor.pass'), 'green')
      : warn
        ? badge(t(lang, 'doctor.warn'), 'yellow')
        : badge(t(lang, 'doctor.fail'), 'red');

  const gpuText =
    rep.hardware.gpus.length > 0
      ? rep.hardware.gpus.map((g) => `${g.name} (${g.vramGb} GB VRAM)`).join(', ')
      : lang === 'tr'
        ? 'NVIDIA GPU tespit edilmedi'
        : 'No NVIDIA GPU detected';

  const lines = [
    c.bold(c.brightCyan(t(lang, 'doctor.envSection'))),
    `  Node.js       ${st(rep.node.ok)}  ${rep.node.version} (FLOP CLI >= v${OFFICIAL_CLI.minNodeMajor})`,
    `  npm / npx     ${st(rep.npm.ok && rep.npx.ok)}  npm ${rep.npm.output || '—'}`,
    `  Docker        ${st(rep.docker.ok, true)}  ${rep.docker.output || 'not installed (only needed for Validator/Miner)'}`,
    `  Git           ${st(rep.git.ok, true)}  ${rep.git.output || 'not installed'}`,
    `  Global flop   ${st(rep.globalFlop.ok, true)}  ${rep.globalFlop.output || `optional (npx runs ${OFFICIAL_CLI.cliPackage})`}`,
    '',
    c.bold(c.brightCyan(t(lang, 'doctor.hwSection'))),
    `  OS / Arch     ${c.white(rep.os)}`,
    `  CPU           ${c.white(`${rep.hardware.cpuCores} logical cores`)} — ${c.gray(rep.hardware.cpuModel)}`,
    `  RAM           ${c.white(`${rep.hardware.ramGb} GB`)}`,
    `  Free Disk     ${c.white(rep.hardware.freeDiskGb !== null ? `${rep.hardware.freeDiskGb} GB` : 'unknown')}`,
    `  NVIDIA GPU    ${c.white(gpuText)}`,
    '',
    c.bold(c.brightCyan(t(lang, 'doctor.roleSection'))),
    `  Agent ($0)    ${rep.roles.agent ? badge(t(lang, 'doctor.eligible'), 'green') : badge(t(lang, 'doctor.notReady'), 'red')}  ${c.gray(t(lang, 'doctor.agentNote'))}`,
    `  Validator     ${
      rep.roles.validatorProduction
        ? badge(t(lang, 'doctor.eligible'), 'green')
        : rep.roles.validatorRehearsal
          ? badge(t(lang, 'doctor.partial'), 'yellow')
          : badge(t(lang, 'doctor.notReady'), 'red')
    }  ${c.gray(rep.roles.validatorProduction ? t(lang, 'doctor.valProdNote') : t(lang, 'doctor.valRehearsalNote'))}`,
    `  Miner (GPU)   ${rep.roles.miner ? badge(t(lang, 'doctor.eligible'), 'green') : badge(t(lang, 'doctor.notReady'), 'red')}  ${c.gray(t(lang, 'doctor.minerNote'))}`,
  ];

  console.log('');
  console.log(drawBox(t(lang, 'doctor.title'), lines, { borderColor: c.green }));
  return rep;
}
