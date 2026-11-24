/**
 * Miner Hardware Readiness Audit & Official Onboarding Info.
 */
import { badge, c, drawBox } from '../ansi.js';
import { HARDWARE_SPECS, OFFICIAL_LINKS } from '../constants.js';
import { t } from '../i18n.js';
import { collectSystemReport } from './doctor.js';

export function runMinerModule(lang = 'en', options = {}) {
  const rep = collectSystemReport();
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          gpus: rep.hardware.gpus,
          maxVramGb: rep.hardware.maxVramGb,
          dockerInstalled: rep.docker.ok,
          minerReady: rep.roles.miner,
          testnetMinerPackLive: false,
          applicationUrl: OFFICIAL_LINKS.minerApplication,
        },
        null,
        2
      )
    );
    return;
  }

  const isTr = lang === 'tr';
  const gpuLines =
    rep.hardware.gpus.length > 0
      ? rep.hardware.gpus.map((g) => {
          const ok = g.vramGb >= HARDWARE_SPECS.miner.minVramGb;
          return `  • ${g.name} — ${g.vramGb} GB VRAM  ${ok ? badge('>= 16GB OK', 'green') : badge('< 16GB', 'red')}`;
        })
      : [
          `  • ${c.red(isTr ? 'NVIDIA GPU bulunamadı (nvidia-smi yanıt vermedi)' : 'No NVIDIA GPU detected (nvidia-smi unavailable)')}`,
        ];

  const lines = [
    c.white(t(lang, 'miner.summary')),
    '',
    c.bold(isTr ? 'Yerel GPU & Docker Taraması:' : 'Local GPU & Docker Scan:'),
    ...gpuLines,
    `  • Docker: ${rep.docker.ok ? badge('OK', 'green') + ' ' + rep.docker.output : badge('MISSING', 'red')}`,
    `  • ${isTr ? 'Genel Uygunluk' : 'Overall Readiness'}: ${rep.roles.miner ? badge('READY FOR PACK RELEASE', 'green') : badge('HARDWARE / DOCKER NEEDED', 'yellow')}`,
    '',
    c.brightYellow(
      isTr
        ? '⚠ Resmi Testnet Miner paketi açılışta henüz yayınlanmadı (canlı miner sayısı: 0).'
        : '⚠ Official Testnet miner pack is not yet published at opening (active miners: 0).'
    ),
    c.bold(isTr ? 'Resmi Miner Kaynakları:' : 'Official Miner Resources:'),
    `  • ${isTr ? 'Miner Başvuru Formu' : 'Miner Application'}: ${c.cyan(OFFICIAL_LINKS.minerApplication)}`,
    `  • ${isTr ? 'Resmi Miner Skill' : 'Official Miner Skill'}: ${c.green('pnpm dlx skills add https://docs.flop.network/skills/setup-miner/SKILL.md -g -y')}`,
    `  • ${isTr ? 'Testnet Stake' : 'Testnet Stake'}: ${c.green(isTr ? 'Sponsorlu (kendi tokenın gerekmez)' : 'Sponsored on testnet (no token deposit needed)')}`,
  ];

  console.log('');
  console.log(drawBox(t(lang, 'miner.title'), lines, { borderColor: c.magenta }));
}
