# X (Twitter) Paylaşım Rehberi — Türkçe (`flop-kit`)

> **Hazır Linkler İşlendi:** GitHub (`https://github.com/0xdead2026/flop-kit`) ve X (`@0Oxdead`) bilgilerin metinlere eklendi.
> **Görsel Tavsiyesi (Etkileşimi 3x Artırır):**
> 1. Görsel: `node bin/flop-kit.js --lang tr` çalıştırıp Terminal Kokpitinin tam ekran görüntüsünü al.
> 2. Görsel: `node bin/flop-kit.js dashboard --lang tr` açıp `http://127.0.0.1:4141` Mission Control Web Panelinin ekran görüntüsünü al (canlı Testnet blok + 3:1 Airdrop Simülatörü görünsün!).

---

## Seçenek A: Tek Parça Uzun X Gönderisi (X Premium / Long Post)

```text
FLOP Labs Testnet için sıfırdan, %100 açık kaynak ve SIFIR bağımlılıklı kendi CLI aracımı + Yerel Web Kontrol Panelimi yaptım: flop-kit

Çoğu rehberde söylenmeyen gerçekleri ve para harcamadan ($0) katılma yolunu tek araçta topladım 👇

> önce herkesin atladığı kritik gerçekler (24 Kasım 2026)

- testnet şu an "unscored opening" (puansız açılış) aşamasında. resmi döküman net söylüyor: duyurulacak aktivasyon bloğundan önceki işlemler 0 puan alır (geriye dönük sayım yok)
- faucet.flop.network şu an hâlâ devnet'e bağlı ve testnet'te henüz 0 aktif miner var
- resmi FLOP Discord, Telegram, Reddit veya Medium YOKTUR. bunların tamamı sahte

> neden flop-kit farklı?

- 0 harici npm paketi (dependencies: {}) -> kodun her satırını 2 dakikada denetleyebilirsin, seed/private key istemez
- çift arayüz: hem ok tuşlu Terminal Kokpiti hem de yerel Mission Control Web Paneli (127.0.0.1:4141)
- Aktivasyon Takipçisi (`watch`): testnet runtime yükseltmesi veya faucet geçişi olduğu an alarm verir, boşa zaman harcamazsın
- resmi dökümana %100 uyumlu `session run` komutu üretici + TR/EN anlık dil değişimi
- dahili Phishing/Domain doğrulayıcı + Airdrop Kilit Açılım Simülatörü

> tek komutla kurulum (npm install bile gerekmez, sadece Node 20/22+)

git clone https://github.com/0xdead2026/flop-kit.git && cd flop-kit && node bin/flop-kit.js --lang tr

web kontrol paneli için:
node bin/flop-kit.js dashboard --lang tr

> para harcamadan ($0) ne yapabilirsin?

1. @flop_labs hesabını takip et (resmi sitede airdrop uygunluğu için belirtiliyor)
2. Agent rolüne hazırlan ($0 — GPU/VPS gerekmez, harici ücretli LLM API anahtarı gerekmez). bugün devnet'te prova yap, `flop-kit watch` ile aktivasyon bloğu açıldığı an gerçek test $FLOP ile inference harcamaya başla (sadece token tutmak veya DID açmak = 0 puan)
3. 800M $FLOP Ekosistem Havuzu ($0): içerik/rehber/araç üretiyorsan flop.finance/apply/kol veya güvenlik bildirimi (security@flop.finance)

> roller ve kimsenin detaylı yazmadığı kilit (unlock) matematiği

- Agent (1.2B havuz, $0): TGE'de %0 likit. mainnet inference'ta harcadığın her 3 kilitli $FLOP için 1 likit $FLOP açılır (max %25 likit, %75 compute için harcanır)
- Miner (1.2B havuz, 16GB+ NVIDIA GPU): TGE %25 likit, kalan %75 mainnet kazancıyla 1:1 açılır
- Validator (1.2B havuz, ilk 50 koltuk dalgası / max 1.000): koltuk başı 1.2M $FLOP ama ~10 yıl (5 halving) boyunca bond olarak kilitli kalır. ayrıca 8+ çekirdek, 32-64GB ECC RAM, 4TB NVMe sunucu ister

açık kaynak GitHub reposu (TR + EN rehber dahil):
https://github.com/0xdead2026/flop-kit

beğenip yer imlerine ekle, puanlı aktivasyon bloğu açıldığı an tam Agent çalıştırma rehberini de güncelleyeceğim. soruları aşağıya yazabilirsin 👇
```

---

## Seçenek B: 5 Twitlik Kısa Flood (Standart X Hesapları İçin)

**1/5**
```text
FLOP Labs Testnet'e para harcamadan ($0) ve güvende kalarak katılmak için sıfırdan kendi açık kaynak CLI + Yerel Web Kontrol Panelimi yaptım: flop-kit

- 0 dış bağımlılık (npm install bile yok)
- Canlı Testnet & Faucet Aktivasyon Takipçisi
- Airdrop 3:1 Kilit Hesaplayıcı
- TR + EN arayüz

Detaylar & link 👇
```

**2/5**
```text
Önce çoğu rehberin atladığı 3 kritik gerçek:

1) Testnet şu an PUANSIZ (unscored) açılışta — aktivasyon bloğundan önceki işlemler 0 puan (no backfill)
2) Faucet hâlâ Devnet'te, Testnet'te aktif miner sayısı 0
3) Resmi FLOP Discord / Telegram / Medium YOK! Hepsi dolandırıcı

Boşa zaman harcamamak için `flop-kit watch` yazdım.
```

**3/5**
```text
Kurulum 10 saniye (Node 20/22+ yeterli):

git clone https://github.com/0xdead2026/flop-kit.git
cd flop-kit
node bin/flop-kit.js --lang tr

Tarayıcıdan canlı panel görmek için:
node bin/flop-kit.js dashboard --lang tr

Seed istemez, private key istemez, sadece resmi flop.network / flop.finance domainlerine bağlanır.
```

**4/5**
```text
$0 maliyetle en mantıklı yol: Agent Rolü (1.2B $FLOP havuzu) + Ekosistem Havuzu (800M $FLOP)

Ama kilit matematiğini bilerek girin:
- Agent: TGE %0 likit -> 3 kilitli harca, 1 likit aç (max %25 likit)
- Miner: %25 TGE + %75 mainnet kazancıyla 1:1
- Validator: 1.2M $FLOP ama ~10 yıl kilitli bond

Hepsini `flop-kit calc` ile anında simüle edebilirsin.
```

**5/5**
```text
GitHub reposu (tamamen açık kaynak, MIT lisanslı, Türkçe + İngilizce dökümanlı):
https://github.com/0xdead2026/flop-kit

Yıldız (Star) bırakıp yer imlerine eklemeyi unutma — puanlı aktivasyon bloğu ve Testnet musluğu açıldığı an aracı güncelleyip bildireceğim.

@flop_labs ekosistemine katkı için görüşlerini yoruma bırakabilirsin 👇
```
