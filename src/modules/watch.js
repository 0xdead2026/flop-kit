/**
 * Live Activation Sniper / Watcher for FLOP Testnet.
 * Polls Testnet JSON-RPC & faucet target to detect runtime upgrades or faucet transitions.
 */
import { c, drawBox, formatNum } from '../ansi.js';
import { t } from '../i18n.js';
import { fetchNetworkSnapshot, probeFaucetIdentity } from '../rpc.js';

export async function runWatch(lang = 'en', options = {}) {
  const intervalSec = Math.max(5, Number(options.interval) || 15);
  const maxPolls = options.once ? 1 : Number(options.maxPolls) || 0;

  console.log(
    drawBox(
      t(lang, 'watch.title'),
      [
        c.white(t(lang, 'watch.subtitle')),
        c.gray(`Interval: ${intervalSec}s | RPC: https://testnet.flop.network/ | Faucet: https://faucet.flop.network/`),
      ],
      { borderColor: c.magenta }
    )
  );
  console.log('');

  let baselineSpec = null;
  let baselineFaucet = null;
  let count = 0;
  let stopped = false;

  const onSigInt = () => {
    stopped = true;
    console.log('\n' + c.yellow(t(lang, 'watch.stopped')));
  };
  process.once('SIGINT', onSigInt);

  try {
    while (!stopped) {
      count += 1;
      const [snap, faucet] = await Promise.all([
        fetchNetworkSnapshot('testnet'),
        probeFaucetIdentity(),
      ]);

      const timeStr = new Date().toLocaleTimeString();
      if (!snap.ok) {
        console.log(c.red(`[${timeStr}] Poll #${count} — RPC error: ${snap.error}`));
      } else {
        const line = t(lang, 'watch.pollLine', {
          n: count,
          time: timeStr,
          block: formatNum(snap.bestBlock),
          spec: snap.specVersion ?? '?',
          peers: formatNum(snap.peers),
          faucet: faucet.detectedTarget,
        });
        console.log(c.cyan(line));

        if (baselineSpec !== null && snap.specVersion !== baselineSpec) {
          process.stdout.write('\x07');
          console.log(
            c.bold(
              c.brightGreen(
                '\n🔔 ' +
                  t(lang, 'watch.alertRuntime', {
                    old: baselineSpec,
                    now: snap.specVersion,
                  }) +
                  '\n'
              )
            )
          );
        }
        baselineSpec = snap.specVersion;

        if (
          baselineFaucet !== null &&
          faucet.detectedTarget !== baselineFaucet &&
          faucet.detectedTarget !== 'unreachable'
        ) {
          process.stdout.write('\x07');
          console.log(
            c.bold(
              c.brightGreen(
                '\n🔔 ' +
                  t(lang, 'watch.alertFaucet', {
                    old: baselineFaucet,
                    now: faucet.detectedTarget,
                  }) +
                  '\n'
              )
            )
          );
        }
        if (faucet.detectedTarget !== 'unreachable') {
          baselineFaucet = faucet.detectedTarget;
        }
      }

      if (maxPolls > 0 && count >= maxPolls) break;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, intervalSec * 1000);
        const checkStop = setInterval(() => {
          if (stopped) {
            clearTimeout(timer);
            clearInterval(checkStop);
            resolve();
          }
        }, 200);
        timer.unref?.();
      });
    }
  } finally {
    process.removeListener('SIGINT', onSigInt);
  }
}
