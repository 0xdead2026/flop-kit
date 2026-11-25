/**
 * 24/7 Autopilot Daemon for FLOP Testnet (lightweight, ~40MB RAM, systemd-friendly).
 *
 * Monitors on a polite interval (default: 600s / 10 min):
 *   1. Live FLOP Testnet RPC block height, genesis match, and runtime specVersion upgrades
 *      (alerts in logs immediately if specVersion bumps -> possible scored activation!).
 *   2. Live faucet.flop.network/health (`ready: true` & HTTP 200) + /chain + /limits.
 *   3. Automatically submits the signed 10 $FLOP Testnet Agent claim once faucet is ready
 *      (reusing the same idempotent nonce across transient errors, and respecting the 24h
 *      cooldown after a confirmed submission so it never spams).
 */
import fs from 'node:fs';
import path from 'node:path';
import { c, drawBox, formatNum } from '../ansi.js';
import { OFFICIAL_LINKS } from '../constants.js';
import { assertOfficialUrl, fetchNetworkSnapshot, probeFaucetIdentity } from '../rpc.js';
import { getKeysDir } from './agent.js';
import { loadSavedClaimState, submitSignedTestnetClaim } from './claim.js';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function shouldAttemptAutoClaim({ health, faucet, savedState, nowMs = Date.now() }) {
  if (!health?.ok || !health?.ready) {
    return { attempt: false, reason: `faucet_not_ready (http=${health?.statusCode ?? '?'}, status=${health?.status ?? 'unknown'})` };
  }
  if (!faucet?.ok || faucet?.detectedTarget !== 'testnet' || !faucet?.genesisVerified) {
    return { attempt: false, reason: `faucet_chain_unverified (target=${faucet?.detectedTarget ?? 'unknown'})` };
  }
  if (faucet.faucetStatus !== 'open') {
    return { attempt: false, reason: `faucet_closed (status=${faucet.faucetStatus ?? 'unknown'})` };
  }

  // Respect 24h cooldown if a prior claim already succeeded
  if (savedState?.txHash && savedState?.status !== 'grant_pending') {
    const updatedAt = Date.parse(savedState.updatedAt || '');
    if (Number.isFinite(updatedAt) && nowMs - updatedAt < COOLDOWN_MS) {
      const hoursLeft = ((COOLDOWN_MS - (nowMs - updatedAt)) / 3600000).toFixed(1);
      return { attempt: false, reason: `cooldown_active (${hoursLeft}h left; tx=${savedState.txHash})` };
    }
  }

  return { attempt: true, reason: 'faucet_ready' };
}

export async function probeFaucetHealth(timeoutMs = 10000) {
  const url = assertOfficialUrl('https://faucet.flop.network/health');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'flop-kit/1.3.0', Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok && Boolean(json?.ready),
      statusCode: res.status,
      status: json?.status || (res.ok ? 'ok' : `http_${res.status}`),
      ready: Boolean(json?.ready),
      indexerOk: json?.dependencies?.indexer?.ok ?? null,
      indexerReason: json?.dependencies?.indexer?.reason || null,
      signingHeld: json?.dependencies?.signing?.held ?? null,
      version: json?.image?.version || null,
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      status: 'unreachable',
      ready: false,
      error: err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function ts() {
  return new Date().toISOString();
}

export async function runAutopilot(lang = 'en', options = {}) {
  const intervalSec = Math.max(60, Number(options.interval) || 600);
  const once = Boolean(options.once);
  const keystorePath = options.keystore || path.join(getKeysDir(), 'agent-testnet.json');
  const passwordEnvName = options.passwordEnv || 'FLOP_KEYSTORE_PASSWORD';
  const password = process.env[passwordEnvName] || '';

  const hasKeystore = fs.existsSync(keystorePath);
  const claimEnabled = hasKeystore && Boolean(password);
  let keystoreAddress = null;
  if (hasKeystore) {
    try {
      keystoreAddress = JSON.parse(fs.readFileSync(keystorePath, 'utf8')).address || null;
    } catch {
      keystoreAddress = null;
    }
  }

  console.log(
    drawBox(
      'FLOP-KIT 24/7 AUTOPILOT DAEMON',
      [
        `Poll Interval:    ${c.cyan(`${intervalSec}s`)} (${(intervalSec / 60).toFixed(1)} min)  |  Mode: ${once ? 'single pass (--once)' : '24/7 daemon'}`,
        `Keystore:         ${hasKeystore ? c.green(keystorePath) : c.yellow(`not found (${keystorePath})`)}`,
        `Address:          ${keystoreAddress ? c.white(keystoreAddress) : c.gray('monitor-only (no keystore)')}`,
        `Auto-Claim:       ${claimEnabled ? c.brightGreen('ENABLED (10 $FLOP when faucet ready=true)') : c.yellow(`MONITOR-ONLY (set ${passwordEnvName} + keystore to enable)`)}`,
        `Endpoints:        ${c.gray('https://testnet.flop.network/ · https://faucet.flop.network/health')}`,
      ],
      { borderColor: c.cyan }
    )
  );

  let baselineSpec = null;
  let cycle = 0;
  let stopped = false;

  const stop = () => {
    stopped = true;
    console.log(`[${ts()}] [AUTOPILOT] Shutdown signal received. Exiting cleanly.`);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopped) {
      cycle += 1;
      const [tn, health, faucet] = await Promise.all([
        fetchNetworkSnapshot('testnet'),
        probeFaucetHealth(),
        probeFaucetIdentity(),
      ]);

      const tnSummary = tn.ok
        ? `block=#${formatNum(tn.bestBlock)} spec=v${tn.specVersion} genesis=${tn.genesisVerified ? 'OK' : 'MISMATCH'} peers=${tn.peers}`
        : `rpc_error=${tn.error}`;

      const faucetSummary = `health=${health.statusCode}/${health.status} ready=${health.ready} indexer=${health.indexerOk === false ? health.indexerReason || 'down' : health.indexerOk} queue=${faucet.pendingGrants ?? '?'} dailyLeft=${faucet.dailyRemainingFlop ?? '?'}`;

      console.log(`[${ts()}] [CYCLE #${cycle}] TESTNET(${tnSummary}) | FAUCET(${faucetSummary})`);

      // Alert loudly on runtime upgrade (possible scored activation block!)
      if (tn.ok && tn.specVersion !== null) {
        if (baselineSpec !== null && tn.specVersion !== baselineSpec) {
          console.log(
            `[${ts()}] [ALERT] Testnet runtime specVersion upgraded: v${baselineSpec} -> v${tn.specVersion}! Check ${OFFICIAL_LINKS.xOfficial} & ${OFFICIAL_LINKS.testnetDocs}`
          );
        }
        baselineSpec = tn.specVersion;
      }

      // Attempt signed claim only when health is ready=true and keystore+password configured
      if (claimEnabled && keystoreAddress) {
        const savedState = loadSavedClaimState(keystoreAddress);
        const decision = shouldAttemptAutoClaim({ health, faucet, savedState });

        if (!decision.attempt) {
          console.log(`[${ts()}] [CLAIM-SKIP] ${decision.reason}`);
        } else {
          console.log(`[${ts()}] [CLAIM-TRY] Faucet is READY — submitting signed 10 $FLOP claim for ${keystoreAddress}...`);
          try {
            const res = await submitSignedTestnetClaim({ keystorePath, password });
            if (res.ok) {
              console.log(
                `[${ts()}] [CLAIM-SUCCESS] 10 test $FLOP submitted! address=${res.address} nonce=${res.nonce} txHash=${res.response?.txHash || 'pending'}`
              );
            } else {
              console.log(
                `[${ts()}] [CLAIM-WAIT] http=${res.httpStatus} reason=${res.response?.reason || 'error'} nonce=${res.nonce} msg=${res.response?.error || 'see response'}`
              );
            }
          } catch (err) {
            console.log(`[${ts()}] [CLAIM-ERR] ${err?.message || err}`);
          }
        }
      }

      if (once || stopped) break;

      await new Promise((resolve) => {
        const timer = setTimeout(resolve, intervalSec * 1000);
        const checkStop = setInterval(() => {
          if (stopped) {
            clearTimeout(timer);
            clearInterval(checkStop);
            resolve();
          }
        }, 500);
        timer.unref?.();
        checkStop.unref?.();
      });
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
