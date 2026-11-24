/**
 * Official Flop Labs Domain & Anti-Phishing URL Verifier.
 * Based strictly on https://flop.finance/official/
 */
import { askLine, badge, c, drawBox } from '../ansi.js';
import {
  FORBIDDEN_SCAM_CHANNELS,
  OFFICIAL_LINKS,
  OFFICIAL_SOCIAL_HANDLES,
} from '../constants.js';
import { t } from '../i18n.js';
import { isOfficialFlopHost } from '../rpc.js';

export function classifyUrl(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { status: 'empty' };

  // Handle shorthand like @flop_labs
  if (trimmed.toLowerCase() === '@flop_labs') {
    return {
      status: 'official',
      normalized: OFFICIAL_SOCIAL_HANDLES.x,
      reason: 'Official Flop Labs X handle (@flop_labs)',
    };
  }

  const withProto = /^https?:\/\//i.test(trimmed) || /^wss?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withProto);
  } catch {
    return { status: 'invalid', normalized: trimmed, reason: 'Malformed URL' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const full = parsed.toString().toLowerCase();

  // Check explicitly forbidden scam platforms (no official Discord/Telegram/Reddit/Medium)
  if (FORBIDDEN_SCAM_CHANNELS.some((bad) => host === bad || host.endsWith(`.${bad}`))) {
    return {
      status: 'scam_channel',
      normalized: parsed.toString(),
      reason: 'Flop Labs officially has NO Discord, Telegram, Reddit, or Medium.',
    };
  }

  // Official root domains (HTTPS / WSS only)
  if (
    (parsed.protocol === 'https:' || parsed.protocol === 'wss:') &&
    isOfficialFlopHost(parsed.hostname)
  ) {
    return {
      status: 'official',
      normalized: parsed.toString(),
      reason: `Verified official root domain (${parsed.hostname})`,
    };
  }

  // Official social & GitHub org paths
  if (
    full.startsWith('https://x.com/flop_labs') ||
    full.startsWith('https://twitter.com/flop_labs') ||
    full.startsWith('https://www.youtube.com/@flop_labs') ||
    full.startsWith('https://youtube.com/@flop_labs') ||
    full.startsWith('https://www.tiktok.com/@flop_labs') ||
    full.startsWith('https://tiktok.com/@flop_labs') ||
    full.startsWith('https://github.com/flop-labs')
  ) {
    return {
      status: 'official',
      normalized: parsed.toString(),
      reason: 'Verified official Flop Labs social/GitHub channel',
    };
  }

  // Detect suspicious lookalike domains containing "flop"
  if (host.includes('flop')) {
    return {
      status: 'suspicious_lookalike',
      normalized: parsed.toString(),
      reason: `Contains "flop" on non-official host (${parsed.hostname}) — high phishing risk!`,
    };
  }

  return {
    status: 'third_party',
    normalized: parsed.toString(),
    reason: `Not an official Flop Labs domain (${parsed.hostname})`,
  };
}

export async function runVerifyModule(lang = 'en', options = {}) {
  const input = options.url ?? (await askLine('\n' + c.brightCyan(t(lang, 'verify.promptUrl'))));

  if (!input) {
    printOfficialDirectory(lang);
    return { status: 'directory' };
  }

  const res = classifyUrl(input);
  if (options.json) {
    console.log(JSON.stringify(res, null, 2));
    return res;
  }

  let verdictBadge;
  let borderColor;
  let label;

  if (res.status === 'official') {
    verdictBadge = badge('OFFICIAL', 'green');
    borderColor = c.green;
    label = t(lang, 'verify.verdictOfficial');
  } else if (res.status === 'scam_channel' || res.status === 'suspicious_lookalike') {
    verdictBadge = badge('DANGER', 'red');
    borderColor = c.red;
    label =
      res.status === 'scam_channel'
        ? t(lang, 'verify.verdictScamChannel')
        : lang === 'tr'
          ? 'YÜKSEK RİSK — TAKLİT / PHISHING DOMAIN ŞÜPHESİ'
          : 'HIGH RISK — LOOKALIKE / PHISHING DOMAIN SUSPECTED';
  } else if (res.status === 'invalid') {
    verdictBadge = badge('INVALID', 'yellow');
    borderColor = c.yellow;
    label = t(lang, 'verify.verdictInvalid');
  } else {
    verdictBadge = badge('UNOFFICIAL', 'yellow');
    borderColor = c.yellow;
    label = t(lang, 'verify.verdictThirdParty');
  }

  console.log('');
  console.log(
    drawBox(
      t(lang, 'verify.title'),
      [
        `Input:   ${c.white(res.normalized || input)}`,
        `Verdict: ${verdictBadge}  ${c.bold(label)}`,
        `Detail:  ${c.gray(res.reason || '')}`,
      ],
      { borderColor }
    )
  );
  return res;
}

export function printOfficialDirectory(lang = 'en') {
  const isTr = lang === 'tr';
  console.log('');
  console.log(
    drawBox(
      isTr ? 'DOĞRULANMIŞ RESMİ FLOP LABS KANALLARI' : 'VERIFIED OFFICIAL FLOP LABS CHANNELS',
      [
        `• Main Site:      ${c.cyan(OFFICIAL_LINKS.website)}`,
        `• Official List:  ${c.cyan(OFFICIAL_LINKS.officialSecurity)}`,
        `• Operator Docs:  ${c.cyan(OFFICIAL_LINKS.docs)}`,
        `• Explorer:       ${c.cyan(OFFICIAL_LINKS.explorerTestnet)}`,
        `• Faucet:         ${c.cyan(OFFICIAL_LINKS.faucet)}`,
        `• Agent Chat:     ${c.cyan(OFFICIAL_LINKS.technocore)}`,
        `• Hosted MCP:     ${c.cyan(OFFICIAL_LINKS.mcpEndpoint)}`,
        `• Official X:     ${c.cyan(OFFICIAL_LINKS.xOfficial)}`,
        `• Official GitHub:${c.cyan(OFFICIAL_LINKS.githubOrg)}`,
        `• Security Email: ${c.cyan(OFFICIAL_LINKS.securityEmail)}`,
        '',
        c.brightRed(
          isTr
            ? '✖ DİKKAT: Resmi FLOP Discord, Telegram, Reddit veya Medium KESİNLİKLE YOKTUR!'
            : '✖ WARNING: There is NO official FLOP Discord, Telegram, Reddit, or Medium!'
        ),
      ],
      { borderColor: c.green }
    )
  );
}
