# flop-kit

**FLOP Network Testnet için Sıfır Bağımlılıklı, Çift Dilli (TR/EN) Etkileşimli Terminal Kokpiti, Aktivasyon Takipçisi ve Yerel Mission Control Web Paneli.**

[English](README.md) | [Türkçe](README.tr.md)

![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D20%20(CLI%2022%2B)-339933?style=flat-square&logo=node.js&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/ba%C4%9F%C4%B1ml%C4%B1l%C4%B1k-0%20paket-22d3ee?style=flat-square)
![License: MIT](https://img.shields.io/badge/lisans-MIT-blue?style=flat-square)
![Dil: TR / EN](https://img.shields.io/badge/dil-TR%20%2F%20EN-c084fc?style=flat-square)

---

## `flop-kit` Neden Farklı?

Çoğu testnet aracı onlarca harici kütüphane kuran, güncel olmayan komutlar kullanan basit sarmalayıcılardır. `flop-kit`, tamamen **resmi Flop Labs dökümanları** (`docs.flop.network`, `flop.network/llms.txt` ve `@flop-labs/cli@0.8.3`) temel alınarak sıfırdan geliştirildi:

* **0 Harici Bağımlılık:** Saf modern Node.js ESM (`dependencies: {}`). `npm install` yok, Python `venv` hatası yok, tedarik zinciri riski yok — kodun tamamı dakikalar içinde denetlenebilir.
* **İmzalı Testnet Faucet Talebi (`claim` — v1.1.0):** Resmi `flop.network/llms.txt` dokümanındaki `flop-faucet-agent/v1` imzalı talep akışını (`/v1/testnet/agent-claims` ile günlük `10 test $FLOP`) uygular — resmi CLI'a henüz gelmeden önce! İmzalamadan önce faucet `/chain` ile canlı RPC blok 0 genesis eşleşmesini doğrular ve kuyrukta kalırsa idempotent `nonce` değerini otomatik saklar.
* **Canlı Faucet `/chain` & `/limits` Telemetrisi:** Testnet faucet durumunu (`open`), bekleyen kuyruk sayısını ve günlük kalan kotayı anlık gösterir.
* **Çift Arayüz (Terminal Kokpiti + Yerel Web Paneli):** İster ok tuşlarıyla yönetilen renkli **Terminal Kokpitini**, ister tek komutla açılan **Yerel Mission Control Web Panelini** (`127.0.0.1:4141`) kullan.
* **Canlı Aktivasyon Takipçisi (`watch`):** Canlı Testnet JSON-RPC `specVersion` değişimlerini ve faucet geçişini izleyip aktivasyon anında alarm verir.
* **Resmi Dökümana %100 Uyumlu Agent Akışı:** Hatalı `flop chat` yerine resmi bütçe limitli `session run` komutları ve harici ücretli API anahtarı gerektirmeyen Hermes + Hosted MCP (`https://mcp.flop.network/mcp`) kurulum şablonları üretir.
* **Dahili Phishing / Oltalama Doğrulayıcı:** Resmi domain beyaz listesini (`flop.finance`, `flop.network`, `flopscan.io`, `technocore.chat`) kontrol eder ve sahte Discord/Telegram/Reddit/Medium gruplarını anında yakalar.
* **Anlık TR / EN Dil Değişimi:** Terminal kokpitinde `L` tuşuna basarak anında Türkçe ↔ İngilizce geçiş yap.

---

## Hızlı Başlangıç (Kurulum / `npm install` Gerekmez)

**Node.js 20+** gerekir (Resmi `@flop-labs/cli@0.7.0` için **Node 22+** önerilir).

```bash
git clone https://github.com/0xdead2026/flop-kit.git
cd flop-kit
node bin/flop-kit.js --lang tr
```

Veya **Yerel Mission Control Web Panelini** doğrudan başlat:

```bash
node bin/flop-kit.js dashboard --lang tr
# Tarayıcında http://127.0.0.1:4141 adresini aç
```

---

## CLI Komutları

| Komut | Açıklama |
| :--- | :--- |
| `node bin/flop-kit.js --lang tr` | Etkileşimli Terminal Kokpitini aç (`↑/↓`, `1-9`, `[L]` TR/EN, `[Q]` çıkış) |
| `node bin/flop-kit.js status --lang tr` | Canlı Testnet & Devnet blok yüksekliği, runtime sürümü, genesis doğrulama ve canlı `/chain` + `/limits` faucet telemetrisi |
| `node bin/flop-kit.js claim --lang tr` | Resmi `/v1/testnet/agent-claims` ile imzalı Testnet 10 `$FLOP` Agent faucet talebi (`--check` ile durum sorgulama) |
| `node bin/flop-kit.js watch --lang tr` | Aktivasyon Takipçisi — runtime yükseltmesi veya faucet değişiminde alarm verir |
| `node bin/flop-kit.js doctor --lang tr` | Node, npm, Docker, CPU, RAM, disk, NVIDIA GPU VRAM ve rol uygunluk analizi |
| `node bin/flop-kit.js agent --lang tr` | `\$0` Agent Merkezi: yerel keystore, resmi `session run` oluşturucu, Hermes/MCP, ekosistem yolları |
| `node bin/flop-kit.js validator --lang tr` | Validatör 3 adımlı kontrol listesi, genesis doğrulama ve GitHub `operator-application.yml` kanıt şablonu |
| `node bin/flop-kit.js miner --lang tr` | NVIDIA 16GB+ VRAM & Docker kontrolü + resmi miner kaynakları |
| `node bin/flop-kit.js calc --role agent --amount 10000 --lang tr` | Onaylanmış airdrop kilit açılım simülatörü (`agent`, `miner`, `validator`) |
| `node bin/flop-kit.js verify <url> --lang tr` | Link/hesabın resmi mi, üçüncü parti mi yoksa sahte kanal mı olduğunu anında doğrula |
| `node bin/flop-kit.js dashboard --lang tr` | Yalnızca yerel (`127.0.0.1`) Mission Control Web Panelini aç |

---

## FLOP Testnet Gerçekleri & Roller

> **Kritik Bilgi:** Resmi dökümana (`docs.flop.network/networks/testnet`) göre Testnet'in açılış aşaması **PUANSIZDIR (unscored)**. Puanlama yalnızca kamuya duyurulacak kesinleşmiş aktivasyon bloğunda başlar (**geriye dönük sayım yoktur**). Devnet işlemleri **0 airdrop puanı** verir.

| Rol | Genesis Havuzu | Maliyet | Donanım | Onaylanmış Mainnet Kilit Açılım Kuralı |
| :--- | :--- | :--- | :--- | :--- |
| **Agent** | `1.2Mrd $FLOP` | **\$0** | Herhangi bir PC (Node 22+) | **TGE %0 likit** · Mainnet inference'ta harcanan her 3 kilitli `$FLOP` için 1 likit `$FLOP` açılır (max **%25** likit, %75 hesaplama için tüketilir) |
| **Miner** | `1.2Mrd $FLOP` | GPU / Kiralama | NVIDIA 16GB+ VRAM + Docker | **TGE %25 likit** · Kalan %75 mainnet kazancıyla **1:1** açılır (stake olarak kullanılabilir) |
| **Validator** | `1.2Mrd $FLOP` | Dedicated Sunucu | 8+ çekirdek ≥3.4GHz, 32–64GB ECC RAM, 4TB NVMe, 1Gbps Linux | Koltuk başı sabit `1.200.000 $FLOP` (max 1.000 koltuk) · **~10 yıl (5 halving) bond olarak kilitli** |
| **Ekosistem** | `800M $FLOP` | **\$0** | Yok | Geliştiriciler, içerik üreticileri/KOL, referanslar ve güvenlik açığı bildirimleri |

---

## Güvenlik Mimarisi

* **0 harici paket:** `package.json` içinde `"dependencies": {}`.
* **Gizli anahtar istemez:** `flop-kit` asla seed phrase, mainnet private key veya cüzdan imzası talep etmez.
* **Katı resmi domain beyaz listesi:** `src/rpc.js` yalnızca resmi Flop Labs domainlerine (`flop.finance`, `flop.network`, `flopscan.io`, `technocore.chat`) HTTPS/WSS isteği gönderir.
* **Sadece yerel web paneli:** Dashboard yalnızca `127.0.0.1` üzerinde çalışır, dış ağa açılmaz.
* **Sahte kanal uyarısı:** Flop Labs'in resmi **Discord, Telegram, Reddit veya Medium kanalı YOKTUR** ([flop.finance/official/](https://flop.finance/official/)).

---

## Testleri Çalıştırma

```bash
npm test
```

---

## Sorumluluk Reddi

`flop-kit` bağımsız, açık kaynaklı bir topluluk aracıdır ve Flop Labs ile resmi bağı yoktur. Test tokenlarının parasal değeri yoktur ve airdrop garantisi verilmez. Tüm hash, domain ve duyuruları her zaman [flop.finance](https://flop.finance/), [docs.flop.network](https://docs.flop.network/) ve [@flop_labs](https://x.com/flop_labs) üzerinden doğrulayın.

---

Geliştiren: **0xdead** ([GitHub: 0xdead2026](https://github.com/0xdead2026) · [X: @0Oxdead](https://x.com/0Oxdead)) · [MIT](LICENSE) lisansı ile yayınlanmıştır.
