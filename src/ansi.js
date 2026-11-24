/**
 * Zero-dependency ANSI terminal UI primitives for flop-kit.
 * Works cleanly on Windows Terminal, PowerShell, macOS Terminal, and Linux shells.
 */
import readline from 'node:readline';

const COLOR_ENABLED =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb';

const code = (open, close = '0') => (str) =>
  COLOR_ENABLED ? `\x1b[${open}m${str}\x1b[${close}m` : String(str);

export const c = Object.freeze({
  reset: (s) => (COLOR_ENABLED ? `\x1b[0m${s}\x1b[0m` : String(s)),
  bold: code('1', '22'),
  dim: code('2', '22'),
  italic: code('3', '23'),
  underline: code('4', '24'),
  cyan: code('36', '39'),
  brightCyan: code('96', '39'),
  green: code('32', '39'),
  brightGreen: code('92', '39'),
  yellow: code('33', '39'),
  brightYellow: code('93', '39'),
  red: code('31', '39'),
  brightRed: code('91', '39'),
  magenta: code('35', '39'),
  brightMagenta: code('95', '39'),
  blue: code('34', '39'),
  brightBlue: code('94', '39'),
  white: code('97', '39'),
  gray: code('90', '39'),
  bgCyan: code('46', '49'),
  bgDark: code('48;5;235', '49'),
  bgTeal: code('48;5;23', '49'),
});

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str) {
  return String(str).replace(ANSI_RE, '');
}

export function visibleLength(str) {
  return [...stripAnsi(str)].length;
}

export function padRight(str, width) {
  const len = visibleLength(str);
  return len >= width ? str : str + ' '.repeat(width - len);
}

export function truncateVisible(str, maxWidth) {
  if (visibleLength(str) <= maxWidth) return str;
  const plain = stripAnsi(str);
  const chars = [...plain];
  return chars.slice(0, Math.max(0, maxWidth - 1)).join('') + '…';
}

export function badge(label, tone = 'cyan') {
  const map = {
    green: c.bold(c.brightGreen(`[ ${label} ]`)),
    yellow: c.bold(c.brightYellow(`[ ${label} ]`)),
    red: c.bold(c.brightRed(`[ ${label} ]`)),
    cyan: c.bold(c.brightCyan(`[ ${label} ]`)),
    magenta: c.bold(c.brightMagenta(`[ ${label} ]`)),
    gray: c.gray(`[ ${label} ]`),
  };
  return map[tone] || map.cyan;
}

export function wrapVisibleLine(str, maxWidth) {
  if (visibleLength(str) <= maxWidth) return [str];

  // Preserve leading ANSI color prefix and leading indentation across wrapped lines
  const leadingAnsiMatch = String(str).match(/^((?:\x1b\[[0-9;]*m)+)/);
  const leadingAnsi = leadingAnsiMatch ? leadingAnsiMatch[1] : '';
  const hasAnsi = ANSI_RE.test(str);
  ANSI_RE.lastIndex = 0;

  const plain = stripAnsi(str);
  const indentMatch = plain.match(/^(\s+)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const body = plain.slice(indent.length);
  const words = body.split(/(\s+)/);

  const wrapped = [];
  let current = indent;

  for (const token of words) {
    if (!token) continue;
    if (visibleLength(current + token) <= maxWidth) {
      current += token;
    } else if (current.trim().length === 0) {
      // Single very long token (like a hash or URL) — hard break cleanly
      let rest = token;
      while (visibleLength(indent + rest) > maxWidth && maxWidth > indent.length + 4) {
        const take = maxWidth - indent.length;
        wrapped.push(indent + [...rest].slice(0, take).join(''));
        rest = [...rest].slice(take).join('');
      }
      current = indent + rest;
    } else {
      wrapped.push(current.trimEnd());
      current = indent + token.trimStart();
    }
  }
  if (current.length > 0) wrapped.push(current.trimEnd());

  if (hasAnsi && leadingAnsi) {
    return wrapped.map((line) => `${leadingAnsi}${line}\x1b[0m`);
  }
  return wrapped;
}

export function drawBox(title, lines, options = {}) {
  const {
    borderColor = c.cyan,
    titleColor = c.bold,
    minWidth = 74,
    maxWidth = Math.min(process.stdout.columns || 100, 96),
  } = options;

  const contentWidths = lines.map((l) => visibleLength(l));
  const titleLen = title ? visibleLength(title) + 4 : 0;
  const innerWidth = Math.max(
    minWidth - 4,
    Math.min(maxWidth - 4, Math.max(titleLen, ...contentWidths, 40))
  );

  const top = title
    ? borderColor('╭─ ') +
      titleColor(title) +
      borderColor(' ' + '─'.repeat(Math.max(1, innerWidth - visibleLength(title) - 1)) + '╮')
    : borderColor('╭' + '─'.repeat(innerWidth + 2) + '╮');

  const body = [];
  for (const line of lines) {
    if (visibleLength(line) <= innerWidth) {
      body.push(borderColor('│') + ' ' + padRight(line, innerWidth) + ' ' + borderColor('│'));
    } else {
      for (const piece of wrapVisibleLine(line, innerWidth)) {
        const fitted =
          visibleLength(piece) > innerWidth
            ? truncateVisible(piece, innerWidth)
            : padRight(piece, innerWidth);
        body.push(borderColor('│') + ' ' + fitted + ' ' + borderColor('│'));
      }
    }
  }

  const bottom = borderColor('╰' + '─'.repeat(innerWidth + 2) + '╯');
  return [top, ...body, bottom].join('\n');
}

export function clearScreen() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[2J\x1b[H');
  }
}

export function askLine(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function formatNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}
