/**
 * Bilingual (EN / TR) translation catalog for flop-kit.
 */

export const MESSAGES = Object.freeze({
  en: {
    langName: 'English',
    langSwitchHint: '[L] Türkçe',
    pressEnter: 'Press Enter to return to menu...',
    chooseOption: 'Use ↑/↓ arrows (or 1-9) and press Enter · [L] Language · [Q] Quit',
    invalidChoice: 'Invalid selection.',
    goodbye: 'Stay safe on FLOP Testnet — verify every domain and never share private keys.',
    securityBannerTitle: 'SECURITY & TESTNET REALITY CHECK',
    securityBannerLines: [
      '• Zero external dependencies (0 npm packages) — every line is locally auditable.',
      '• NEVER asks for seed phrases, private keys, or real mainnet funds.',
      '• Opening phase is UNSCORED until the announced activation block (no backfill).',
      '• NO official FLOP Discord, Telegram, Reddit, or Medium exists — watch out for scams.',
    ],
    menu: {
      status: 'Live Network Status & Genesis Check (Testnet + Devnet)',
      watch: 'Activation Sniper (Watch Runtime Upgrade & Faucet Switch)',
      doctor: 'System Doctor & Role Eligibility Audit (CPU / RAM / GPU)',
      agent: '$0 Agent Hub (Keystore, Official session run, Hermes, Faucet)',
      validator: 'Validator Prep & Devnet Rehearsal Receipt Generator',
      miner: 'Miner Hardware Readiness (NVIDIA 16GB+ VRAM & Docker)',
      calc: 'Airdrop & Unlock Math Simulator (3:1 Agent / Miner / Validator)',
      verify: 'Official Domain & Anti-Phishing URL Verifier',
      dashboard: 'Launch Local Mission Control Web Dashboard (127.0.0.1)',
      exit: 'Exit flop-kit',
    },
    status: {
      title: 'LIVE FLOP NETWORK TELEMETRY',
      fetching: 'Querying live JSON-RPC endpoints and faucet identity...',
      chain: 'Chain',
      block: 'Best Block',
      finalized: 'Finalized Block',
      runtime: 'Runtime Spec',
      peers: 'RPC Peers',
      genesis: 'Genesis Hash',
      genesisMatch: 'VERIFIED MATCH',
      genesisMismatch: 'MISMATCH — DO NOT TRUST',
      offline: 'UNREACHABLE',
      faucetTitle: 'FAUCET LIVE PROBE',
      faucetTarget: 'Detected Faucet Target',
      faucetDevnetWarn: 'Faucet still targets DEVNET (0 airdrop credit). Wait for official Testnet faucet.',
      faucetTestnetReady: 'Faucet appears to reference TESTNET — verify genesis hash before claiming!',
      faucetUnknown: 'Could not determine faucet network automatically — inspect https://faucet.flop.network/',
      scoredWarning: 'UNSCORED OPENING NOTICE: Early Testnet activity earns 0 until the announced activation block.',
    },
    watch: {
      title: 'FLOP TESTNET ACTIVATION SNIPER',
      subtitle: 'Monitoring runtime specVersion, block progression, and faucet network switch. Press Ctrl+C to stop.',
      pollLine: 'Poll #{n} @ {time} | Block #{block} | Runtime v{spec} | Peers: {peers} | Faucet: {faucet}',
      alertRuntime: 'ALERT: Testnet runtime specVersion changed ({old} -> {now})! Check @flop_labs & docs.flop.network!',
      alertFaucet: 'ALERT: Faucet target changed ({old} -> {now})! Verify https://faucet.flop.network/',
      stopped: 'Watcher stopped.',
    },
    doctor: {
      title: 'SYSTEM DOCTOR & HARDWARE ELIGIBILITY AUDIT',
      envSection: 'Runtime & Tooling',
      hwSection: 'Local Hardware Profile',
      roleSection: 'FLOP Role Readiness Matrix',
      pass: 'PASS',
      warn: 'WARN',
      fail: 'MISSING',
      eligible: 'READY',
      partial: 'REHEARSAL ONLY',
      notReady: 'INSUFFICIENT',
      agentNote: '$0 cost — runs locally via official @flop-labs/cli + test FLOP',
      valRehearsalNote: 'Can run keyless Devnet rehearsal (4 CPU / 16GB RAM / 300GB SSD)',
      valProdNote: 'Production Validator needs 8+ cores >=3.4GHz, 32-64GB ECC RAM, 4TB NVMe, Linux amd64',
      minerNote: 'Needs NVIDIA GPU >=16GB VRAM + Docker (Testnet miner pack pending)',
    },
    agent: {
      title: '$0 AGENT HUB (OFFICIAL CLI WORKFLOW)',
      warningUnscored:
        'Testnet is in its unscored opening phase with 0 active miners. Practice safely on Devnet today, then switch to --network testnet once the scored activation block & faucet open.',
      actions: [
        '1. Check official @flop-labs/cli@0.7.0 availability',
        '2. Create / inspect dedicated local keystore directory (~/.flop-kit/keys)',
        '3. Generate official `session run` command (capped test FLOP spend)',
        '4. View Hermes Agent + Hosted MCP (https://mcp.flop.network/mcp) setup',
        '5. View $0 Ecosystem Bonus Paths (Follow @flop_labs, KOL/Builder, Security, technocore.chat)',
        '0. Back to main menu',
      ],
    },
    validator: {
      title: 'VALIDATOR PREP & RECEIPT GENERATOR',
      summary:
        'Opening wave targets 50 seats (+25%/day growth) up to 1,000 mainnet seats. Each mainnet seat carries 1,200,000 $FLOP bonded & linearly unlocked over ~10 years (5 halvings). Registering records interest only — it does NOT grant a seat.',
      actions: [
        '1. Review official 3-step qualification & hardware checklist',
        '2. Generate formatted GitHub `operator-application.yml` Observation Receipt snippet',
        '3. Verify expected Testnet raw chain spec SHA-256 & genesis hash',
        '0. Back to main menu',
      ],
    },
    miner: {
      title: 'MINER HARDWARE READINESS',
      summary:
        'Miners serve verified AI inference (Proof of Useful Inference) from a 1.2B $FLOP pool (25% liquid at genesis, 75% unlocked 1:1 with mainnet earnings). Requires NVIDIA 16GB+ VRAM + Docker. Testnet miner pack is not publicly published yet.',
    },
    calc: {
      title: 'AIRDROP & UNLOCK MATH SIMULATOR',
      note: 'Based on ratified rules in docs.flop.network/docs/airdrop-and-testnet-conversion (note: runtime still shows 90-day linear vesting until final upgrade).',
      promptRole: 'Select role to simulate — [1] Agent (3:1 spend unlock)  [2] Miner (25% TGE + 1:1 earn)  [3] Validator (1.2M / ~10y bond)  [0] Back: ',
      promptAmount: 'Enter estimated $FLOP allocation (e.g. 10000): ',
    },
    verify: {
      title: 'OFFICIAL DOMAIN & ANTI-PHISHING VERIFIER',
      promptUrl: 'Paste any URL or handle to verify (or press Enter to list all official channels): ',
      verdictOfficial: 'OFFICIAL VERIFIED CHANNEL',
      verdictScamChannel: 'HIGH RISK — FAKE CHANNEL (Flop Labs has NO Discord/Telegram/Reddit/Medium)',
      verdictThirdParty: 'UNOFFICIAL / THIRD-PARTY — Proceed with caution; never enter seeds or private keys',
      verdictInvalid: 'Invalid URL format.',
    },
    dashboard: {
      starting: 'Starting local Mission Control Web Dashboard (zero dependencies, 127.0.0.1 only)...',
      running: 'Mission Control Dashboard live at: {url}',
      hint: 'Open the link in your browser. Press Ctrl+C to stop the local server.',
    },
  },
  tr: {
    langName: 'Türkçe',
    langSwitchHint: '[L] English',
    pressEnter: 'Ana menüye dönmek için Enter tuşuna bas...',
    chooseOption: '↑/↓ ok tuşları (veya 1-9) + Enter · [L] Dil Değiştir · [Q] Çıkış',
    invalidChoice: 'Geçersiz seçim.',
    goodbye: 'FLOP Testnet sürecinde güvende kal — her domaini doğrula ve asla private key paylaşma.',
    securityBannerTitle: 'GÜVENLİK & TESTNET GERÇEKLİK KONTROLÜ',
    securityBannerLines: [
      '• Sıfır dış bağımlılık (0 npm paketi) — kodun her satırı yerelde denetlenebilir.',
      '• ASLA seed phrase, private key veya gerçek mainnet parası istemez.',
      '• Açılış aşaması PUANSIZDIR (unscored); puanlama duyurulacak aktivasyon bloğunda başlar (geriye dönük sayım yok).',
      '• Resmi FLOP Discord, Telegram, Reddit veya Medium YOKTUR — sahte gruplara dikkat et.',
    ],
    menu: {
      status: 'Canlı Ağ Durumu & Genesis Doğrulama (Testnet + Devnet)',
      watch: 'Aktivasyon Takipçisi (Runtime Yükseltme & Faucet Geçiş Alarmı)',
      doctor: 'Sistem Doktoru & Rol Uygunluk Analizi (CPU / RAM / GPU)',
      agent: '$0 Agent Merkezi (Keystore, Resmi session run, Hermes, Faucet)',
      validator: 'Validator Hazırlık & Devnet Prova Kanıt Şablonu Üretici',
      miner: 'Miner Donanım Kontrolü (NVIDIA 16GB+ VRAM & Docker)',
      calc: 'Airdrop & Kilit Açılım Simülatörü (3:1 Agent / Miner / Validator)',
      verify: 'Resmi Domain & Oltalama (Phishing) Link Doğrulayıcı',
      dashboard: 'Yerel Mission Control Web Panelini Başlat (127.0.0.1)',
      exit: 'flop-kit Çıkış',
    },
    status: {
      title: 'CANLI FLOP NETWORK TELEMETRİSİ',
      fetching: 'Canlı JSON-RPC uç noktaları ve faucet kimliği sorgulanıyor...',
      chain: 'Zincir',
      block: 'Güncel Blok',
      finalized: 'Kesinleşmiş Blok',
      runtime: 'Runtime Sürümü',
      peers: 'RPC Eşleri',
      genesis: 'Genesis Hash',
      genesisMatch: 'DOĞRULANDI (EŞLEŞTİ)',
      genesisMismatch: 'UYUŞMAZLIK — GÜVENME!',
      offline: 'ERİŞİLEMEDİ',
      faucetTitle: 'CANLI FAUCET KONTROLÜ',
      faucetTarget: 'Tespit Edilen Faucet Ağı',
      faucetDevnetWarn: 'Faucet hâlâ DEVNET ağına bağlı (0 airdrop puanı). Resmi Testnet musluğunu bekle.',
      faucetTestnetReady: 'Faucet TESTNET referansı veriyor — talep etmeden önce genesis hash doğrula!',
      faucetUnknown: 'Faucet ağı otomatik tespit edilemedi — https://faucet.flop.network/ adresini kontrol et.',
      scoredWarning: 'PUANSIZ AÇILIŞ UYARISI: Duyurulacak aktivasyon bloğundan önceki Testnet işlemleri 0 puan alır.',
    },
    watch: {
      title: 'FLOP TESTNET AKTİVASYON TAKİPÇİSİ',
      subtitle: 'Runtime specVersion, blok ilerleyişi ve faucet ağ geçişi canlı izleniyor. Durdurmak için Ctrl+C.',
      pollLine: 'Kontrol #{n} @ {time} | Blok #{block} | Runtime v{spec} | Eş: {peers} | Faucet: {faucet}',
      alertRuntime: 'ALARM: Testnet runtime specVersion değişti ({old} -> {now})! @flop_labs ve docs.flop.network kontrol et!',
      alertFaucet: 'ALARM: Faucet hedefi değişti ({old} -> {now})! https://faucet.flop.network/ kontrol et!',
      stopped: 'Takipçi durduruldu.',
    },
    doctor: {
      title: 'SİSTEM DOKTORU & DONANIM UYGUNLUK ANALİZİ',
      envSection: 'Çalışma Ortamı & Araçlar',
      hwSection: 'Yerel Donanım Profili',
      roleSection: 'FLOP Rol Uygunluk Matrisi',
      pass: 'UYGUN',
      warn: 'UYARI',
      fail: 'EKSİK',
      eligible: 'HAZIR',
      partial: 'SADECE PROVA',
      notReady: 'YETERSİZ',
      agentNote: '$0 maliyet — resmi @flop-labs/cli + test FLOP ile yerel çalışır',
      valRehearsalNote: 'Anahtarsız Devnet provası çalıştırılabilir (4 CPU / 16GB RAM / 300GB SSD)',
      valProdNote: 'Gerçek Validator için 8+ çekirdek >=3.4GHz, 32-64GB ECC RAM, 4TB NVMe, Linux amd64 gerekir',
      minerNote: 'NVIDIA GPU >=16GB VRAM + Docker gerekir (Testnet miner paketi henüz çıkmadı)',
    },
    agent: {
      title: '$0 AGENT MERKEZİ (RESMİ CLI AKIŞI)',
      warningUnscored:
        'Testnet şu an puansız açılış aşamasında ve aktif miner sayısı 0. Bugün Devnet üzerinde ücretsiz prova yapabilir, aktivasyon bloğu ve Testnet musluğu açıldığında --network testnet ile geçebilirsin.',
      actions: [
        '1. Resmi @flop-labs/cli@0.7.0 erişilebilirliğini kontrol et',
        '2. Ayrı yerel keystore klasörü oluştur / incele (~/.flop-kit/keys)',
        '3. Resmi `session run` (bütçe limitli harcama) komutu üret',
        '4. Hermes Agent + Hosted MCP (https://mcp.flop.network/mcp) kurulum bilgisi',
        '5. $0 Ekosistem Bonus Yolları (@flop_labs takip, KOL/Builder, Güvenlik, technocore.chat)',
        '0. Ana menüye dön',
      ],
    },
    validator: {
      title: 'VALIDATOR HAZIRLIK & KANIT ÜRETİCİ',
      summary:
        'Açılış dalgası ilk 50 koltuk (+%25/gün büyüme) hedefliyor; mainnet tavanı 1.000 koltuk. Koltuk başına 1.200.000 $FLOP tahsis var ancak ~10 yıl (5 halving) boyunca bond olarak kilitli kalır. Başvuru yapmak koltuk garantisi vermez.',
      actions: [
        '1. Resmi 3 adımlı eleme ve donanım kontrol listesini gör',
        '2. GitHub `operator-application.yml` için Gözlem Kanıtı (Observation Receipt) şablonu üret',
        '3. Beklenen Testnet raw chain spec SHA-256 ve genesis hash değerlerini doğrula',
        '0. Ana menüye dön',
      ],
    },
    miner: {
      title: 'MINER DONANIM KONTROLÜ',
      summary:
        'Miner rolü 1.2M $FLOP havuzundan (TGE %25 likit, %75 mainnet kazancıyla 1:1 açılım) doğrulanmış AI inference sunarak kazanır. NVIDIA 16GB+ VRAM + Docker gerekir. Resmi Testnet miner paketi henüz yayınlanmadı.',
    },
    calc: {
      title: 'AIRDROP & KİLİT AÇILIM SİMÜLATÖRÜ',
      note: 'docs.flop.network/docs/airdrop-and-testnet-conversion kurallarına göredir (not: zincir kodunda nihai güncelleme öncesi 90 günlük lineer vesting görünmektedir).',
      promptRole: 'Simüle edilecek rol — [1] Agent (3:1 harcama açılımı)  [2] Miner (%25 TGE + 1:1)  [3] Validator (1.2M / ~10 yıl)  [0] Geri: ',
      promptAmount: 'Tahmini $FLOP tahsisini gir (örn. 10000): ',
    },
    verify: {
      title: 'RESMİ DOMAIN & PHISHING LİNK DOĞRULAYICI',
      promptUrl: 'Doğrulamak istediğin URL veya adresi yapıştır (tüm resmi kanallar için boş Enter): ',
      verdictOfficial: 'RESMİ DOĞRULANMIŞ KANAL',
      verdictScamChannel: 'YÜKSEK RİSK — SAHTE KANAL (Flop Labs resmi Discord/Telegram/Reddit/Medium açmamıştır)',
      verdictThirdParty: 'RESMİ DEĞİL / ÜÇÜNCÜ PARTİ — Dikkatli ol; asla seed veya private key girme',
      verdictInvalid: 'Geçersiz URL biçimi.',
    },
    dashboard: {
      starting: 'Yerel Mission Control Web Paneli başlatılıyor (sıfır bağımlılık, sadece 127.0.0.1)...',
      running: 'Mission Control Paneli aktif: {url}',
      hint: 'Linki tarayıcında açabilirsin. Yerel sunucuyu durdurmak için Ctrl+C tuşuna bas.',
    },
  },
});

export function detectDefaultLang() {
  const envLang = (process.env.FLOP_KIT_LANG || process.env.LANG || process.env.LC_ALL || '').toLowerCase();
  if (envLang.startsWith('tr')) return 'tr';
  return 'en';
}

export function t(lang, path, vars = {}) {
  const dict = MESSAGES[lang] || MESSAGES.en;
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = cur[p];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== 'string') return cur ?? path;
  return cur.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
