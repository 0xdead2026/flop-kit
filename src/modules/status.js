/**
 * Live network telemetry & genesis integrity report (Testnet + Devnet + Faucet).
 */
import { badge, c, drawBox, formatNum } from '../ansi.js';
import { OFFICIAL_LINKS } from '../constants.js';
import { t } from '../i18n.js';
import { fetchFullTelemetry } from '../rpc.js';

function renderNetworkLines(snap, lang) {
  if (!snap.ok) {
    return [
      `${c.bold(snap.network.toUpperCase())}  ${badge(t(lang, 'status.offline'), 'red')}`,
      `  RPC: ${c.gray(snap.rpcHttp)}`,
      `  Error: ${c.red(snap.error)}`,
    ];
  }

  const genBadge = snap.genesisVerified
    ? badge(t(lang, 'status.genesisMatch'), 'green')
    : badge(t(lang, 'status.genesisMismatch'), 'red');

  const shortGen = `${snap.genesisHash.slice(0, 14)}…${snap.genesisHash.slice(-10)}`;

  return [
    `${c.bold(c.brightCyan(snap.network.toUpperCase()))}  ${genBadge}  ${c.gray(`${snap.latencyMs}ms`)}`,
    `  ${t(lang, 'status.chain')}:           ${c.white(snap.chainName)}  ${c.gray(`(${snap.rpcHttp})`)}`,
    `  ${t(lang, 'status.block')}:      ${c.brightGreen('#' + formatNum(snap.bestBlock))}   |  ${t(lang, 'status.finalized')}: ${c.cyan('#' + formatNum(snap.finalizedBlock))}`,
    `  ${t(lang, 'status.runtime')}:    ${c.brightYellow(`${snap.specName || 'flop'} v${snap.specVersion ?? '?'}`)}   |  ${t(lang, 'status.peers')}: ${c.white(formatNum(snap.peers))}`,
    `  ${t(lang, 'status.genesis')}:    ${c.gray(shortGen)}`,
  ];
}

export async function runStatus(lang = 'en', options = {}) {
  if (!options.json) {
    console.log(c.dim(t(lang, 'status.fetching')));
  }

  const data = await fetchFullTelemetry();

  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return data;
  }

  const gw = data.gateway;
  const gwLines = gw
    ? [
        '',
        c.bold(lang === 'tr' ? 'CANLI TESTNET GATEWAY & AKTİF MODELLER' : 'LIVE TESTNET GATEWAY & SERVING MODELS'),
        `  Gateway: ${gw.ok ? badge('LIVE · OK', 'green') : badge(String(gw.status || 'OFFLINE').toUpperCase(), 'yellow')}  ${c.gray(gw.url)}  |  ${lang === 'tr' ? 'Aktif Model' : 'Models'}: ${c.brightCyan(formatNum(gw.modelCount))}  |  ${lang === 'tr' ? 'Servis Veren Miner' : 'Serving Miners'}: ${c.brightGreen(formatNum(gw.uniqueMinerCount))}`,
        ...(gw.models?.length
          ? gw.models.map(
              (m) =>
                `    • ${c.white(m.id)}  ${c.gray(`(${m.minerCount} miners · ${m.capacityTpm ? formatNum(m.capacityTpm) + ' tok/min' : 'n/a'})`)}`
            )
          : [`    ${c.gray(lang === 'tr' ? 'Henüz aktif servis veren model yok.' : 'No actively serving models yet.')}`]),
      ]
    : [];

  const lines = [
    ...renderNetworkLines(data.testnet, lang),
    ...gwLines,
    '',
    ...renderNetworkLines(data.devnet, lang),
    '',
    c.bold(t(lang, 'status.faucetTitle')),
    `  ${t(lang, 'status.faucetTarget')}: ${
      data.faucet.detectedTarget === 'testnet'
        ? badge('TESTNET', 'green')
        : data.faucet.detectedTarget === 'devnet'
          ? badge('DEVNET', 'yellow')
          : badge(String(data.faucet.detectedTarget).toUpperCase(), 'gray')
    }  ${
      data.faucet.faucetStatus
        ? badge(String(data.faucet.faucetStatus).toUpperCase(), data.faucet.faucetStatus === 'open' ? 'green' : 'yellow')
        : ''
    }  ${c.gray(OFFICIAL_LINKS.faucet)}`,
    ...(data.faucet.detectedTarget === 'testnet' && data.faucet.agentGrantFlop
      ? [
          `  Agent Grant: ${c.brightGreen(`${data.faucet.agentGrantFlop} FLOP / 24h`)} (${c.cyan(data.faucet.claimPath || '/v1/testnet/agent-claims')})  |  Queue: ${c.yellow(formatNum(data.faucet.pendingGrants))}  |  Daily Left: ${c.white(formatNum(data.faucet.dailyRemainingFlop) + ' FLOP')}`,
          `  ${c.gray(lang === 'tr' ? 'İmzalı talep için: node bin/flop-kit.js claim --lang tr' : 'Submit signed claim: node bin/flop-kit.js claim')}`,
        ]
      : [
          `  ${
            data.faucet.detectedTarget === 'devnet'
              ? c.yellow(t(lang, 'status.faucetDevnetWarn'))
              : data.faucet.detectedTarget === 'testnet'
                ? c.brightGreen(t(lang, 'status.faucetTestnetReady'))
                : c.gray(t(lang, 'status.faucetUnknown'))
          }`,
        ]),
    '',
    c.brightYellow(`⚠ ${t(lang, 'status.scoredWarning')}`),
    c.gray(`  Explorer: ${OFFICIAL_LINKS.explorerTestnet}  |  Docs: ${OFFICIAL_LINKS.testnetDocs}`),
  ];

  console.log('');
  console.log(drawBox(t(lang, 'status.title'), lines, { borderColor: c.cyan }));
  return data;
}
