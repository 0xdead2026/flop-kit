/**
 * $0 Agent Hub — Official @flop-labs/cli workflow, keystore setup, and ecosystem paths.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { askLine, badge, c, drawBox } from '../ansi.js';
import { NETWORKS, OFFICIAL_CLI, OFFICIAL_LINKS } from '../constants.js';
import { t } from '../i18n.js';

export function getKeysDir() {
  return path.join(os.homedir(), '.flop-kit', 'keys');
}

export function ensureKeysDir() {
  const dir = getKeysDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      // Ignore permission adjustment errors on constrained filesystems
    }
  }
  return dir;
}

export function buildOfficialSessionCommand({
  network = 'devnet',
  keystorePath = path.join(getKeysDir(), `agent-${network}.json`),
  miner = '<MINER_SS58_ADDRESS>',
  model = 'qwen/qwen2.5-0.5b-instruct',
  prompt = 'Summarize Proof of Useful Inference in one sentence.',
  maxFlop = '0.01',
} = {}) {
  const net = network === 'testnet' ? 'testnet' : 'devnet';
  return [
    `npx --yes --package ${OFFICIAL_CLI.cliPackage} flop \\`,
    `  --network ${net} \\`,
    `  --keystore "${keystorePath}" \\`,
    `  --password-env FLOP_KEY_PASSWORD \\`,
    `  session run \\`,
    `  --miner "${miner}" \\`,
    `  --model ${model} \\`,
    `  --prompt "${prompt.replace(/"/g, '\\"')}" \\`,
    `  --max-flop ${maxFlop} \\`,
    `  --via auto --json`,
  ].join('\n');
}

export async function runAgentHub(lang = 'en', options = {}) {
  if (options.nonInteractive) {
    printAgentOverview(lang);
    return;
  }

  while (true) {
    console.log('');
    console.log(
      drawBox(
        t(lang, 'agent.title'),
        [
          c.brightYellow(`⚠ ${t(lang, 'agent.warningUnscored')}`),
          '',
          ...t(lang, 'agent.actions').map((a) => c.white(a)),
        ],
        { borderColor: c.cyan }
      )
    );

    const choice = await askLine(c.brightCyan('\nSelect [0-5]: '));
    if (choice === '0' || choice === '' || choice.toLowerCase() === 'q') break;

    if (choice === '1') {
      console.log(c.dim(`\nChecking official CLI (${OFFICIAL_CLI.cliPackage})...`));
      try {
        const execBin = process.platform === 'win32' ? 'cmd.exe' : 'npx';
        const execArgs =
          process.platform === 'win32'
            ? ['/d', '/s', '/c', 'npx', '--yes', '--package', OFFICIAL_CLI.cliPackage, 'flop', '--version']
            : ['--yes', '--package', OFFICIAL_CLI.cliPackage, 'flop', '--version'];
        const out = execFileSync(execBin, execArgs, {
          encoding: 'utf8',
          timeout: 30000,
          windowsHide: true,
        }).trim();
        console.log(badge('OK', 'green') + ' ' + c.brightGreen(out));
      } catch (err) {
        console.log(
          badge('WARN', 'yellow') +
            ' ' +
            c.yellow(
              lang === 'tr'
                ? `CLI şu an indirilemedi/çalıştırılamadı: ${err.message}`
                : `Could not execute CLI right now: ${err.message}`
            )
        );
      }
    } else if (choice === '2') {
      const dir = ensureKeysDir();
      const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      console.log(
        drawBox(
          lang === 'tr' ? 'YEREL KEYSTORE KLASÖRÜ' : 'LOCAL KEYSTORE DIRECTORY',
          [
            `Path: ${c.brightCyan(dir)}`,
            `Existing keystores: ${existing.length ? c.green(existing.join(', ')) : c.gray('none yet')}`,
            '',
            lang === 'tr'
              ? c.yellow('• Asla ana cüzdan seed/private key kullanma; sadece bu testnete özel boş cüzdan aç.')
              : c.yellow('• Never reuse a mainnet wallet/seed; create a dedicated test-only keystore.'),
            lang === 'tr'
              ? c.gray('• Devnet provasında resmi CLI --new-wallet bayrağıyla otomatik test cüzdanı üretebilir.')
              : c.gray('• On Devnet practice, the official CLI can also create a test wallet with --new-wallet.'),
          ],
          { borderColor: c.green }
        )
      );
    } else if (choice === '3') {
      const netIn = (
        await askLine(
          lang === 'tr'
            ? 'Ağ seç [devnet/testnet] (varsayılan: devnet): '
            : 'Target network [devnet/testnet] (default: devnet): '
        )
      ).toLowerCase();
      const network = netIn === 'testnet' ? 'testnet' : 'devnet';
      const maxFlop =
        (await askLine(
          lang === 'tr'
            ? 'İşlem başı maksimum harcama tavanı --max-flop (varsayılan: 0.01): '
            : 'Per-session spend cap --max-flop (default: 0.01): '
        )) || '0.01';
      const cmd = buildOfficialSessionCommand({ network, maxFlop });
      console.log('\n' + c.bold(c.brightCyan(lang === 'tr' ? 'Resmi Komut (session run):' : 'Official Command (session run):')));
      console.log(c.green(cmd));
      console.log(
        c.gray(
          `\nNote: Uses official 'session run' instead of 'flop chat' (which requires EconomicCritical appraisal).\n` +
            `Genesis (${network}): ${NETWORKS[network].expectedGenesis}\n` +
            `Faucet: ${OFFICIAL_LINKS.faucet}`
        )
      );
    } else if (choice === '4') {
      console.log(
        drawBox(
          'HERMES AGENT & HOSTED MCP ($0)',
          [
            lang === 'tr'
              ? '• Harici ücretli OpenAI/Anthropic API anahtarı GEREKMEZ — doğrudan test $FLOP ile inference öder.'
              : '• No external paid OpenAI/Anthropic API key needed — pays inference directly in test $FLOP.',
            `• Hermes Agent: ${c.cyan(OFFICIAL_LINKS.hermesAgent)}`,
            `• Hosted Read-Only MCP: ${c.cyan(OFFICIAL_LINKS.mcpEndpoint)}`,
            '',
            c.bold(lang === 'tr' ? '~/.hermes/config.yaml MCP bloğu:' : '~/.hermes/config.yaml MCP snippet:'),
            c.green('  mcp_servers:'),
            c.green('    flop_network:'),
            c.green(`      url: "${OFFICIAL_LINKS.mcpEndpoint}"`),
            '',
            c.bold(lang === 'tr' ? 'Bütçe limitli Hermes doğrudan çalıştırma:' : 'Budget-capped Hermes direct command:'),
            c.green(
              `  npx --yes --package ${OFFICIAL_CLI.cliPackage} flop --network testnet --keystore agent.json --password-env FLOP_KEY_PASSWORD hermes direct --terminal --max-flop 0.05 --budget-flop 5`
            ),
          ],
          { borderColor: c.magenta }
        )
      );
    } else if (choice === '5') {
      console.log(
        drawBox(
          lang === 'tr' ? '$0 EKOSİSTEM BONUS YOLLARI (800M $FLOP HAVUZU)' : '$0 ECOSYSTEM BONUS PATHS (800M $FLOP POOL)',
          [
            `1. ${c.bold('Follow @flop_labs on X')} — ${c.cyan(OFFICIAL_LINKS.xOfficial)}`,
            lang === 'tr'
              ? '   Resmi sitede airdrop uygunluğu için takip edilmesi belirtiliyor.'
              : '   Explicitly noted on flop.finance for airdrop eligibility.',
            `2. ${c.bold('KOL / Creator / Referral Form ($0)')} — ${c.cyan(OFFICIAL_LINKS.kolApplication)}`,
            lang === 'tr'
              ? '   İçerik, rehber veya açık kaynak araç paylaşarak 800M ekosistem havuzuna başvur.'
              : '   Apply to the 800M Ecosystem Reserve with guides, content, or open-source tools.',
            `3. ${c.bold('technocore.chat ($0 HTTP Agent Chat)')} — ${c.cyan(OFFICIAL_LINKS.technocore)}`,
            lang === 'tr'
              ? '   Gas veya ödeme gerektirmeden ajan mesajlaşma ve koordinasyon ağı.'
              : '   Free, gasless HTTP-native agent coordination and notes platform.',
            `4. ${c.bold('Security Disclosures ($0)')} — ${c.cyan(OFFICIAL_LINKS.securityEmail)}`,
            lang === 'tr'
              ? '   Güvenlik açıklarını özel bildirerek 800M ekosistem havuzundan ödül şansı.'
              : '   Responsible vulnerability disclosures may earn rewards from the 800M reserve.',
          ],
          { borderColor: c.green }
        )
      );
    }
  }
}

export function printAgentOverview(lang = 'en') {
  console.log(
    drawBox(
      t(lang, 'agent.title'),
      [
        c.brightYellow(`⚠ ${t(lang, 'agent.warningUnscored')}`),
        '',
        c.bold('Official Quickstart (Devnet Practice):'),
        c.green(`  npx --yes --package ${OFFICIAL_CLI.cliPackage} flop --network devnet network status`),
        '',
        c.bold('Official Session Run Template:'),
        ...buildOfficialSessionCommand({ network: 'devnet' }).split('\n').map((l) => c.green('  ' + l)),
        '',
        `Faucet: ${c.cyan(OFFICIAL_LINKS.faucet)}  |  Docs: ${c.cyan(OFFICIAL_LINKS.agentIntegration)}`,
      ],
      { borderColor: c.cyan }
    )
  );
}
