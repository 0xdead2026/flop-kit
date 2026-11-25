# flop-kit

**Zero-Dependency, Bilingual (EN/TR) Interactive CLI Cockpit, Activation Sniper & Local Mission Control Dashboard for the FLOP Network Testnet.**

[English](README.md) | [Türkçe](README.tr.md)

![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D20%20(CLI%2022%2B)-339933?style=flat-square&logo=node.js&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20packages-22d3ee?style=flat-square)
![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Languages: EN / TR](https://img.shields.io/badge/i18n-EN%20%2F%20TR-c084fc?style=flat-square)

---

## Why `flop-kit` Is Different

Most testnet setup scripts are opaque wrappers with dozens of external dependencies and outdated commands. `flop-kit` is engineered from scratch around the **official Flop Labs documentation** (`docs.flop.network`, `flop.network/llms.txt`, and `@flop-labs/cli@0.8.3`):

* **0 External Dependencies:** Pure modern Node.js ESM (`dependencies: {}`). No `npm install`, no Python `venv` headaches, zero supply-chain risk — every line is auditable in minutes.
* **Signed Testnet Faucet Claim (`claim` — v1.1.0):** Implements the official `flop-faucet-agent/v1` signed claim flow (`/v1/testnet/agent-claims` for `10 test $FLOP / 24h`) documented in `flop.network/llms.txt` — even before the official CLI adds a Testnet claim subcommand! Verifies both faucet `/chain` and live RPC block 0 genesis before signing, and preserves pending nonces automatically for safe idempotent retries.
* **Live Faucet `/chain` & `/limits` Telemetry:** Reads real-time Testnet faucet status (`open`), pending queue size, and daily remaining cap.
* **Dual Interface (TUI + Local Web Dashboard):** Use the keyboard-driven ANSI **Terminal Cockpit** OR launch the built-in **Local Mission Control Web UI** (`127.0.0.1:4141`) with live telemetry, unlock simulator, and anti-phishing checker.
* **Live Activation Sniper (`watch`):** Monitors live Testnet JSON-RPC `specVersion` upgrades and faucet transitions so you know the moment scored earning begins.
* **Official-Spec Agent Flow:** Generates official capped `session run` commands (avoiding the broken `flop chat` path) and Hermes + Hosted MCP (`https://mcp.flop.network/mcp`) configs.
* **Built-In Anti-Phishing Verifier:** Enforces an official root-domain allowlist (`flop.finance`, `flop.network`, `flopscan.io`, `technocore.chat`) and flags fake Discord/Telegram/Reddit/Medium scams instantly.
* **Instant EN / TR Bilingual CLI:** Press `L` anywhere in the Terminal Cockpit to switch between English and Turkish.

---

## Quickstart (Zero Install Required)

Requires **Node.js 20+** (Node **22+** recommended for running official `@flop-labs/cli@0.7.0`).

```bash
git clone https://github.com/0xdead2026/flop-kit.git
cd flop-kit
node bin/flop-kit.js
```

Or launch the **Local Mission Control Web Dashboard** directly:

```bash
node bin/flop-kit.js dashboard
# Open http://127.0.0.1:4141 in your browser
```

---

## CLI Commands

| Command | Description |
| :--- | :--- |
| `node bin/flop-kit.js` | Launch interactive Terminal Cockpit (`↑/↓`, `1-9`, `[L]` EN/TR, `[Q]` quit) |
| `node bin/flop-kit.js status [--json]` | Live Testnet & Devnet block height, runtime version, genesis verification & live `/chain` + `/limits` faucet telemetry |
| `node bin/flop-kit.js claim [--check]` | Signed Testnet Agent faucet claim (`10 $FLOP / 24h`) via official `/v1/testnet/agent-claims` with auto idempotent nonce retry |
| `node bin/flop-kit.js watch [--interval 15]` | Activation Sniper — alerts on runtime upgrade or faucet shift |
| `node bin/flop-kit.js doctor [--json]` | Audit Node, npm, Docker, CPU, RAM, disk, NVIDIA GPU VRAM & role eligibility |
| `node bin/flop-kit.js agent` | `$0` Agent Hub: local keystore dir, official `session run` builder, Hermes/MCP, ecosystem paths |
| `node bin/flop-kit.js validator` | Validator 3-step checklist, Testnet genesis check & GitHub `operator-application.yml` receipt generator |
| `node bin/flop-kit.js miner [--json]` | NVIDIA 16GB+ VRAM & Docker check + official miner resources |
| `node bin/flop-kit.js calc --role agent --amount 10000` | Simulate ratified unlock math (`agent`, `miner`, or `validator`) |
| `node bin/flop-kit.js verify <url>` | Verify whether a URL/handle is official, third-party, or a high-risk scam channel |
| `node bin/flop-kit.js dashboard [--port 4141]` | Start local-only (`127.0.0.1`) Mission Control Web Dashboard |

Use `--lang tr` or `--lang en` with any command to set the output language.

---

## FLOP Testnet Reality Check & Roles

> **Important:** Per official documentation (`docs.flop.network/networks/testnet`), the opening Testnet phase is **UNSCORED** until the publicly announced finalized activation block of a future runtime upgrade (with **no backfill**). Devnet activity earns **zero** airdrop credit.

| Role | Genesis Pool | Real Cost | Hardware | Ratified Mainnet Unlock Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Agent** | `1.2B $FLOP` | **\$0** | Any PC (Node 22+) | **0% TGE liquid** · Spend 3 locked `$FLOP` on mainnet inference → unlock 1 liquid `$FLOP` (max **25%** liquid, 75% consumed for compute) |
| **Miner** | `1.2B $FLOP` | GPU / Rental | NVIDIA 16GB+ VRAM + Docker | **25% liquid at genesis** · 75% unlocks **1:1** with mainnet earnings (usable as stake) |
| **Validator** | `1.2B $FLOP` | Dedicated Server | 8+ cores ≥3.4GHz, 32–64GB ECC RAM, 4TB NVMe, 1Gbps Linux | Fixed `1,200,000 $FLOP`/seat (max 1,000 seats) · **Bonded & linear over ~10 years** (5 halvings) |
| **Ecosystem** | `800M $FLOP` | **\$0** | None | Builders, creators/KOLs, referrals, responsible security disclosures |

---

## Security Architecture

* **Zero third-party packages:** `package.json` has `"dependencies": {}`.
* **No secrets requested:** `flop-kit` never asks for seed phrases, mainnet private keys, or wallet signatures.
* **Strict network allowlist:** `src/rpc.js` refuses any non-HTTPS/WSS URL or any host outside official Flop Labs root domains (`flop.finance`, `flop.network`, `flopscan.io`, `technocore.chat`).
* **Localhost-only dashboard:** The web UI binds strictly to `127.0.0.1` and never exposes ports to the public network.
* **Official channels only:** Flop Labs officially has **NO Discord, Telegram, Reddit, or Medium** ([flop.finance/official/](https://flop.finance/official/)).

---

## Run Tests

```bash
npm test
```

---

## Disclaimer

`flop-kit` is an independent, open-source community tool and is not affiliated with Flop Labs. Test tokens have no monetary value and no airdrop is guaranteed. Always verify hashes, domains, and announcements directly on [flop.finance](https://flop.finance/), [docs.flop.network](https://docs.flop.network/), and [@flop_labs](https://x.com/flop_labs).

---

Built by **0xdead** ([GitHub: 0xdead2026](https://github.com/0xdead2026) · [X: @0Oxdead](https://x.com/0Oxdead)) · Licensed under [MIT](LICENSE).
