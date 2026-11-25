# X (Twitter) Launch Guide — English (`flop-kit`)

> **Ready to Post:** Branded with your GitHub (`https://github.com/0xdead2026/flop-kit`) and X (`@0Oxdead`).
> **Recommended Visuals (Huge Engagement Boost):**
> 1. Screenshot 1: Terminal Cockpit (`node bin/flop-kit.js`) showing live Testnet block, verified genesis badge, and bilingual menu.
> 2. Screenshot 2: Local Mission Control Web Dashboard (`node bin/flop-kit.js dashboard` → `http://127.0.0.1:4141`) showing live telemetry + the interactive 3:1 Agent Unlock Simulator.

---

## Option A: Single Long-Form X Post (Best for Bookmarks & KOL/Builder Visibility)

```text
i built a zero-dependency CLI cockpit + local Mission Control web dashboard for the @flop_labs testnet from scratch: flop-kit

no python venv pain. 0 npm dependencies. auditable in 2 minutes. works on Windows, macOS & Linux.

here's what most guides skip & how to prepare for $0 👇

> 3 reality checks before you waste time or money

- testnet is currently in its UNSCORED opening phase. official docs are explicit: activity before the announced activation block earns ZERO (no backfill)
- faucet.flop.network still points to devnet & live testnet has 0 settled miners yet
- there is NO official FLOP Discord, Telegram, Reddit, or Medium — every invite is a scam

> what makes flop-kit different

- 0 external dependencies (`dependencies: {}`) — never asks for seeds or mainnet keys
- dual mode: interactive ANSI Terminal Cockpit + local-only Web Dashboard (`127.0.0.1:4141`)
- Activation Sniper (`flop-kit watch`): polls live testnet JSON-RPC `specVersion` + faucet target and alerts you the moment scored activation / testnet faucet goes live
- uses official `session run` (not broken `flop chat`), verifies genesis hashes, generates GitHub `operator-application.yml` receipts, and includes a built-in anti-phishing URL verifier
- instant EN / TR bilingual switch

> run in 10 seconds (no `npm install` needed, just Node 20/22+)

git clone https://github.com/0xdead2026/flop-kit.git && cd flop-kit && node bin/flop-kit.js

launch the local web dashboard:
node bin/flop-kit.js dashboard

> $0 participation playbook

1. follow @flop_labs (listed on flop.finance for airdrop eligibility)
2. prepare as an Agent ($0, no GPU, no VPS, no paid OpenAI API key needed — pays inference directly in test $FLOP). practice on devnet now, then switch to testnet once the activation block opens (holding faucet tokens or creating DIDs = 0)
3. 800M $FLOP Ecosystem Reserve ($0): ship open-source tools/guides & apply via flop.finance/apply/kol, or submit responsible security reports to security@flop.finance

> the unlock math everyone glosses over (built into `flop-kit calc`)

- Agents (1.2B pool, $0): 0% liquid at TGE. every 3 locked $FLOP spent on mainnet inference unlocks 1 liquid $FLOP (max 25% liquid, 75% consumed for compute)
- Miners (1.2B pool, 16GB+ NVIDIA GPU): 25% liquid at genesis, 75% unlocks 1:1 with mainnet earnings
- Validators (1.2B pool, 50-seat opening wave -> 1,000 cap): fixed 1.2M $FLOP per seat, bonded & unlocking linearly over ~10 years (5 halvings) — needs 8+ cores, 32-64GB ECC RAM, 4TB NVMe

open-source repo (MIT, EN + TR docs):
https://github.com/0xdead2026/flop-kit

bookmark & star the repo if this saved you time — i'll update it as soon as the scored activation block & testnet miner pack drop. drop questions below 👇
```

---

## Option B: Concise 4-Post Thread

**1/4**
```text
Built a zero-dependency CLI cockpit + local Mission Control web UI for the @flop_labs Testnet: flop-kit

- 0 npm packages (pure Node.js ESM, auditable in 2 min)
- Live Testnet/Devnet RPC & Activation Sniper (`watch`)
- Interactive 3:1 Agent / Miner / Validator unlock simulator
- Anti-phishing verifier + EN/TR toggle

Repo & $0 guide 👇
```

**2/4**
```text
Before you rent expensive GPUs or farm blindly — 3 facts verified directly from docs.flop.network & testnet.flopscan.io:

1) Opening Testnet phase is UNSCORED (zero backfill before the announced activation block)
2) Faucet still serves Devnet; active Testnet miners = 0
3) There is NO official FLOP Discord, Telegram, Reddit, or Medium

Run `flop-kit watch` to get alerted when the chain upgrades or faucet switches.
```

**3/4**
```text
One-command launch (no `npm install`, no Python venv):

git clone https://github.com/0xdead2026/flop-kit.git
cd flop-kit
node bin/flop-kit.js

Or open the local 127.0.0.1 Mission Control dashboard:
node bin/flop-kit.js dashboard

Uses official `@flop-labs/cli@0.7.0` `session run` commands and enforces a strict official-domain allowlist.
```

**4/4**
```text
$0 paths into the 4.4B $FLOP genesis pool:
- Agent (1.2B pool): $0 local PC — settled Testnet inference spend only (0% TGE, 3:1 spend-to-unlock -> max 25% liquid)
- Ecosystem Reserve (800M pool): open-source builders, guides/KOLs (flop.finance/apply/kol), security disclosures

Full open-source repo + EN/TR docs:
https://github.com/0xdead2026/flop-kit
```

---

## Option C: v1.1.0 Release Post (Signed Testnet 10 $FLOP Faucet Claim!)

```text
just shipped flop-kit v1.1.0 🚀

@flop_labs switched faucet.flop.network over to FLOP Testnet — and even the official `@flop-labs/cli@0.8.3` doesn't have a signed Testnet claim command yet (confirmed in flop.network/llms.txt).

so i added the official `flop-faucet-agent/v1` signed claim flow directly into flop-kit (still 0 external npm dependencies):

• `node bin/flop-kit.js status` -> live `/chain` & `/limits` faucet telemetry (status, pending queue, daily remaining cap)
• `node bin/flop-kit.js claim` -> verifies faucet + RPC block 0 genesis before signing, submits to `/v1/testnet/agent-claims`, and automatically persists your idempotent nonce for safe `grant_pending` retries
• updated to `@flop-labs/cli@0.8.3` & `@flop-labs/sdk@0.11.0`

open-source repo (MIT, 0 dependencies):
https://github.com/0xdead2026/flop-kit

testnet is still unscored (no backfill before voucher start block), but setting up a dedicated sr25519 agent keystore & queuing your first 10 test $FLOP is $0 👇
```
