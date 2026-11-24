/**
 * Validator Prep & GitHub operator-application.yml Observation Receipt Generator.
 */
import { askLine, badge, c, drawBox } from '../ansi.js';
import { NETWORKS, OFFICIAL_LINKS } from '../constants.js';
import { t } from '../i18n.js';
import { fetchNetworkSnapshot } from '../rpc.js';

export function formatObservationReceipt({
  teamId = 'my-team',
  peerId = '<PEER_ID>',
  multiaddr = '/ip4/<PUBLIC_IP>/tcp/30333/p2p/<PEER_ID>',
  obs1Height = '<BLOCK_1>',
  obs1Hash = '<HASH_1>',
  obs2Height = '<BLOCK_2>',
  obs2Hash = '<HASH_2>',
} = {}) {
  return [
    `### Keyless Devnet Sync & Restart Observation Receipt (${teamId})`,
    '',
    `- **Chain:** \`flop_devnet\``,
    `- **Expected Genesis:** \`${NETWORKS.devnet.expectedGenesis}\``,
    `- **Advertised P2P Multiaddr:** \`${multiaddr}\``,
    `- **Peer ID (unchanged across restart):** \`${peerId}\``,
    `- **Tailscale / Overlay Used:** No (direct public TCP 30333)`,
    '',
    '| Observation | Finalized Height | Finalized Block Hash | Peer ID |',
    '| :--- | :--- | :--- | :--- |',
    `| Observation 1 (Pre-Restart) | \`#${obs1Height}\` | \`${obs1Hash}\` | \`${peerId}\` |`,
    `| Observation 2 (Post-Restart, same volume) | \`#${obs2Height}\` | \`${obs2Hash}\` | \`${peerId}\` |`,
    '',
    '_Note: Only public telemetry included; no seeds, private keys, or secret configs._',
  ].join('\n');
}

export async function runValidatorModule(lang = 'en', options = {}) {
  if (options.nonInteractive) {
    printValidatorChecklist(lang);
    return;
  }

  while (true) {
    console.log('');
    console.log(
      drawBox(
        t(lang, 'validator.title'),
        [
          c.white(t(lang, 'validator.summary')),
          '',
          ...t(lang, 'validator.actions').map((a) => c.white(a)),
        ],
        { borderColor: c.yellow }
      )
    );

    const choice = await askLine(c.brightCyan('\nSelect [0-3]: '));
    if (choice === '0' || choice === '' || choice.toLowerCase() === 'q') break;

    if (choice === '1') {
      printValidatorChecklist(lang);
    } else if (choice === '2') {
      const teamId = (await askLine('Team ID: ')) || 'my-team';
      const peerId = (await askLine('Peer ID (12D3KooW...): ')) || '<PEER_ID>';
      const multiaddr =
        (await askLine('Public P2P Multiaddr (/ip4/.../tcp/30333/p2p/...): ')) ||
        `/ip4/<PUBLIC_IP>/tcp/30333/p2p/${peerId}`;
      const obs1Height = (await askLine('Observation 1 Finalized Height: ')) || '100000';
      const obs1Hash = (await askLine('Observation 1 Finalized Hash (0x...): ')) || '0x...';
      const obs2Height = (await askLine('Observation 2 Finalized Height (post-restart): ')) || '100120';
      const obs2Hash = (await askLine('Observation 2 Finalized Hash (0x...): ')) || '0x...';

      const md = formatObservationReceipt({
        teamId,
        peerId,
        multiaddr,
        obs1Height,
        obs1Hash,
        obs2Height,
        obs2Hash,
      });

      console.log('\n' + c.bold(c.brightGreen('--- COPY BELOW INTO YOUR GITHUB ISSUE ---')));
      console.log(md);
      console.log(c.bold(c.brightGreen('--- END RECEIPT ---')));
      console.log(c.gray(`Form: ${OFFICIAL_LINKS.operatorApplication}`));
    } else if (choice === '3') {
      console.log(c.dim('\nVerifying live Testnet genesis hash against official docs...'));
      const snap = await fetchNetworkSnapshot('testnet');
      const lines = [
        `Expected Spec File:   ${c.cyan(NETWORKS.testnet.expectedChainSpecFile)}`,
        `Expected Spec SHA256: ${c.cyan(NETWORKS.testnet.expectedChainSpecSha256)}`,
        `Expected Genesis:     ${c.cyan(NETWORKS.testnet.expectedGenesis)}`,
        `Live RPC Genesis:     ${snap.ok ? c.white(snap.genesisHash) : c.red(snap.error)}`,
        `Verification Status:  ${
          snap.ok && snap.genesisVerified
            ? badge('EXACT MATCH', 'green')
            : badge('FAILED / UNREACHABLE', 'red')
        }`,
      ];
      console.log(drawBox('TESTNET CHAIN SPEC & GENESIS CHECK', lines, { borderColor: c.cyan }));
    }
  }
}

export function printValidatorChecklist(lang = 'en') {
  const isTr = lang === 'tr';
  const lines = isTr
    ? [
        c.bold('Resmi 3 Adımlı Validatör Eleme Süreci:'),
        `  1. GitHub Başvurusu ($0, sadece sıraya alma): ${c.cyan(OFFICIAL_LINKS.operatorApplication)}`,
        '  2. Anahtarsız (Keyless) Devnet Provası: Linux sunucuda observer düğümü senkronize et,',
        '     restart sonrası aynı Peer ID + daha yüksek bloğu 2 Gözlem Kanıtı olarak issue altına ekle.',
        '  3. İmzalı Testnet Kiti (Henüz yayınlanmadı): Yayınlandığında sponsorlu stake ile katıl.',
        '',
        c.bold('Donanım Gereksinimleri (GPU gerekmez):'),
        '  • Devnet Provası için: 4 vCPU / 16 GB RAM / 300 GB SSD + Docker',
        '  • Gerçek Testnet/Mainnet Validatör: 8+ fiziksel çekirdek (>=3.4 GHz),',
        '    32 GB ECC RAM (64 GB önerilen), 4 TB enterprise NVMe, 1 Gbps simetrik, Linux amd64',
        '  • Açık Portlar: TCP 30333 (P2P), filtreli 7001 (DA) — 9944/9615/7000 KAPALI tutulmalı.',
        '',
        c.brightYellow('⚠ Ödül Kilit Uyarısı: 1.2M $FLOP koltuk tahsisi bond olarak ~10 yıl (5 halving) kilitlidir!'),
        `  Resmi Rehber: ${c.cyan(OFFICIAL_LINKS.validatorPrep)}`,
      ]
    : [
        c.bold('Official 3-Step Validator Qualification:'),
        `  1. GitHub Registration ($0, interest only): ${c.cyan(OFFICIAL_LINKS.operatorApplication)}`,
        '  2. Keyless Devnet Rehearsal: Sync observer replica on Linux without Tailscale,',
        '     restart on same volume, post 2 Observation Receipts with identical Peer ID on your issue.',
        '  3. Signed Testnet Joining Kit (Pending release): Verify SHA-256 & join via sponsored stake.',
        '',
        c.bold('Hardware Requirements (CPU-only, NO GPU):'),
        '  • Devnet Rehearsal: 4 vCPU / 16 GB RAM / 300 GB SSD + Docker',
        '  • Production Validator: 8+ physical cores (>=3.4 GHz), 32 GB ECC RAM (64 GB rec),',
        '    4 TB enterprise NVMe, 1 Gbps symmetric, Linux amd64, Node 24+, Docker 28+',
        '  • Ports: Public TCP 30333 (P2P), filtered 7001 (DA) — keep 9944/9615/7000 private.',
        '',
        c.brightYellow('⚠ Lockup Catch: 1.2M $FLOP per seat is a validator bond unlocking over ~10 years (5 halvings).'),
        `  Official Prep Docs: ${c.cyan(OFFICIAL_LINKS.validatorPrep)}`,
      ];

  console.log(drawBox(t(lang, 'validator.title'), lines, { borderColor: c.yellow }));
}
