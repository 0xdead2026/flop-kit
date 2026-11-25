/**
 * Zero-dependency W3C Ed25519 did:key generator & inspector for FLOP / TechnoCore.
 *
 * Uses Node.js built-in `node:crypto` only (0 external packages):
 *   - Generates an Ed25519 keypair
 *   - Derives the standard W3C multicodec did:key (`0xed 0x01` + 32-byte pubkey -> Base58BTC -> `did:key:z6Mk...`)
 *   - Stores the private key encrypted with AES-256-CBC PKCS#8 PEM outside any Git repo (`~/.flop-kit/keys/did-ed25519.pem`)
 *   - Stores public metadata separately (`~/.flop-kit/keys/did-public.json`) — NEVER stores passwords or raw private keys
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { badge, c, drawBox } from '../ansi.js';
import { OFFICIAL_LINKS } from '../constants.js';
import { ensureKeysDir, getKeysDir } from './agent.js';

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Standard 12-byte ASN.1 DER SPKI header for Ed25519 public keys
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
// Multicodec varint prefix for ed25519-pub (0xed, 0x01)
const ED25519_MULTICODEC_PREFIX = Buffer.from([0xed, 0x01]);

export function encodeBase58Btc(bytes) {
  const buf = Buffer.from(bytes);
  if (buf.length === 0) return '';

  let leadingZeros = 0;
  for (let i = 0; i < buf.length && buf[i] === 0; i += 1) {
    leadingZeros += 1;
  }

  let value = BigInt('0x' + buf.toString('hex'));
  const chars = [];
  while (value > 0n) {
    const rem = Number(value % 58n);
    chars.push(BASE58_ALPHABET[rem]);
    value /= 58n;
  }

  return '1'.repeat(leadingZeros) + chars.reverse().join('');
}

export function extractRawEd25519PublicKey(publicKeyObj) {
  const spkiDer = publicKeyObj.export({ type: 'spki', format: 'der' });
  if (
    spkiDer.length !== 44 ||
    !spkiDer.subarray(0, 12).equals(ED25519_SPKI_PREFIX)
  ) {
    throw new Error('Unexpected Ed25519 SPKI DER public key format');
  }
  return spkiDer.subarray(12);
}

export function publicKeyBytesToDidKey(rawPubKey32) {
  const buf = Buffer.from(rawPubKey32);
  if (buf.length !== 32) {
    throw new Error(`Ed25519 raw public key must be 32 bytes (got ${buf.length})`);
  }
  const multicodecBytes = Buffer.concat([ED25519_MULTICODEC_PREFIX, buf]);
  return `did:key:z${encodeBase58Btc(multicodecBytes)}`;
}

export function getDidFiles(baseDir = getKeysDir()) {
  return {
    pemPath: path.join(baseDir, 'did-ed25519.pem'),
    pubPath: path.join(baseDir, 'did-public.json'),
  };
}

export function generateEncryptedDid({
  password,
  baseDir = ensureKeysDir(),
  force = false,
} = {}) {
  if (!password || String(password).length < 8) {
    throw new Error(
      'Encryption password (min 8 chars) is required via FLOP_KEYSTORE_PASSWORD.'
    );
  }

  fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  const { pemPath, pubPath } = getDidFiles(baseDir);

  if (!force && (fs.existsSync(pemPath) || fs.existsSync(pubPath))) {
    throw new Error(
      `DID identity already exists at ${pemPath}. Pass --force to overwrite (not recommended).`
    );
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawPub = extractRawEd25519PublicKey(publicKey);
  const did = publicKeyBytesToDidKey(rawPub);

  const encryptedPem = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: password,
  });

  const publicMeta = {
    did,
    algorithm: 'Ed25519',
    publicKeyHex: `0x${rawPub.toString('hex')}`,
    encryptedKeyFile: path.basename(pemPath),
    purpose: 'FLOP / TechnoCore agent identity (did:key)',
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(pemPath, encryptedPem, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(pubPath, JSON.stringify(publicMeta, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });

  return {
    ...publicMeta,
    pemPath,
    pubPath,
  };
}

export function inspectLocalDid(baseDir = getKeysDir()) {
  const { pemPath, pubPath } = getDidFiles(baseDir);
  if (!fs.existsSync(pubPath)) {
    return { exists: false, pemPath, pubPath };
  }
  const meta = JSON.parse(fs.readFileSync(pubPath, 'utf8'));
  return {
    exists: true,
    hasEncryptedPem: fs.existsSync(pemPath),
    pemPath,
    pubPath,
    ...meta,
  };
}

export function verifyEncryptedDidPassphrase(pemPath, password) {
  const pem = fs.readFileSync(pemPath, 'utf8');
  const privKey = crypto.createPrivateKey({
    key: pem,
    format: 'pem',
    passphrase: password,
  });
  const pubKey = crypto.createPublicKey(privKey);
  const rawPub = extractRawEd25519PublicKey(pubKey);
  const did = publicKeyBytesToDidKey(rawPub);

  // Quick round-trip sign & verify check
  const sample = Buffer.from(`flop-kit-did-check:${did}`);
  const sig = crypto.sign(null, sample, privKey);
  const valid = crypto.verify(null, sample, pubKey, sig);
  return { valid, did, publicKeyHex: `0x${rawPub.toString('hex')}` };
}

export async function runDidModule(lang = 'en', options = {}) {
  const isTr = lang === 'tr';
  const passwordEnvName = options.passwordEnv || 'FLOP_KEYSTORE_PASSWORD';
  const existing = inspectLocalDid();

  // Create mode
  if (options.create) {
    if (existing.exists && !options.force) {
      if (options.json) {
        console.log(JSON.stringify({ ok: true, alreadyExists: true, ...existing }, null, 2));
        return existing;
      }
      console.log('');
      console.log(
        drawBox(
          isTr ? 'MEVCUT YEREL DID KİMLİĞİ' : 'EXISTING LOCAL DID IDENTITY',
          [
            `Status:     ${badge(isTr ? 'ZATEN MEVCUT' : 'ALREADY EXISTS', 'green')}`,
            `DID:        ${c.brightCyan(existing.did)}`,
            `Public Key: ${c.gray(existing.publicKeyHex)}`,
            `Key File:   ${c.white(existing.pemPath)} ${c.gray('(encrypted)')}`,
            '',
            c.yellow(
              isTr
                ? 'Not: Mevcut kimliği korumak için üzerine yazılmadı (sadece --force ile yenilenir).'
                : 'Note: Existing identity was preserved (pass --force only if you intentionally want a new DID).'
            ),
          ],
          { borderColor: c.green }
        )
      );
      return existing;
    }

    const password = process.env[passwordEnvName] || '';
    if (!password) {
      const msg = isTr
        ? `${passwordEnvName} ortam değişkeni boş. Şifreli DID oluşturmak için parolayı ortam değişkeniyle ver:\n  PowerShell: $env:${passwordEnvName} = "PAROLAN"; node bin/flop-kit.js did --create --lang tr`
        : `${passwordEnvName} env var is not set. Provide an encryption passphrase via environment variable:\n  PowerShell: $env:${passwordEnvName} = "YOUR_PASSWORD"; node bin/flop-kit.js did --create`;
      if (options.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
      else console.log('\n' + c.yellow(msg));
      return { ok: false, error: msg };
    }

    const created = generateEncryptedDid({ password, force: Boolean(options.force) });
    if (options.json) {
      console.log(JSON.stringify({ ok: true, created: true, ...created }, null, 2));
      return created;
    }

    console.log('');
    console.log(
      drawBox(
        isTr ? 'YENİ ŞİFRELİ ED25519 DID OLUŞTURULDU' : 'NEW ENCRYPTED ED25519 DID CREATED',
        [
          `Status:     ${badge('CREATED & ENCRYPTED', 'green')}`,
          `DID:        ${c.brightCyan(created.did)}`,
          `Algorithm:  ${c.white(created.algorithm)} (W3C multicodec 0xed01 · Base58BTC)`,
          `Public Key: ${c.gray(created.publicKeyHex)}`,
          `Key File:   ${c.white(created.pemPath)} ${c.gray('(AES-256-CBC PKCS#8 PEM)')}`,
          `Public File:${c.gray(created.pubPath)}`,
          '',
          c.brightYellow(
            isTr
              ? '⚠ Hatırlatma: Sadece DID oluşturmak 0 airdrop puanı verir (sadece onaylı inference harcaması sayılır).'
              : '⚠ Reminder: Creating a DID alone earns 0 airdrop credit (only settled Testnet inference spend scores).'
          ),
          c.gray(`TechnoCore Agent Chat: ${OFFICIAL_LINKS.technocore}`),
        ],
        { borderColor: c.green }
      )
    );
    return created;
  }

  // Inspect / default view
  if (options.json) {
    console.log(JSON.stringify(existing, null, 2));
    return existing;
  }

  if (existing.exists) {
    console.log('');
    console.log(
      drawBox(
        isTr ? 'YEREL AGENT DID KİMLİĞİ (ED25519)' : 'LOCAL AGENT DID IDENTITY (ED25519)',
        [
          `Status:     ${existing.hasEncryptedPem ? badge('ACTIVE · ENCRYPTED', 'green') : badge('MISSING PEM', 'red')}`,
          `DID:        ${c.brightCyan(existing.did)}`,
          `Public Key: ${c.gray(existing.publicKeyHex)}`,
          `Key File:   ${c.white(existing.pemPath)}`,
          `Created At: ${c.gray(existing.createdAt || '—')}`,
          '',
          c.gray(
            isTr
              ? `• TechnoCore (${OFFICIAL_LINKS.technocore}) ajan mesajlaşması ve kimlik imzalaması içindir.`
              : `• Used for TechnoCore (${OFFICIAL_LINKS.technocore}) agent messaging and identity signing.`
          ),
          c.yellow(
            isTr
              ? '• Asla did-ed25519.pem dosyasını paylaşma veya GitHub reposuna yükleme.'
              : '• Never share did-ed25519.pem or commit it to any GitHub repository.'
          ),
        ],
        { borderColor: c.cyan }
      )
    );
  } else {
    console.log('');
    console.log(
      drawBox(
        isTr ? 'YEREL DID KİMLİĞİ HENÜZ OLUŞTURULMADI' : 'NO LOCAL DID IDENTITY YET',
        [
          `Expected Path: ${c.gray(existing.pemPath)}`,
          '',
          c.bold(isTr ? 'Sıfır bağımlılıkla şifreli Ed25519 did:key oluşturmak için:' : 'Create an encrypted Ed25519 did:key (0 dependencies):'),
          c.green(`  $env:${passwordEnvName} = "YOUR_PASSWORD"`),
          c.green(`  node bin/flop-kit.js did --create${isTr ? ' --lang tr' : ''}`),
          '',
          c.yellow(
            isTr
              ? 'Not: Sadece DID açmak airdrop puanı vermez; TechnoCore ajan koordinasyonu içindir.'
              : 'Note: Creating a DID earns 0 airdrop credit on its own; it is for TechnoCore agent coordination.'
          ),
        ],
        { borderColor: c.yellow }
      )
    );
  }
  return existing;
}
