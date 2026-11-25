#!/usr/bin/env bash
# ==============================================================================
# flop-kit 24/7 Ubuntu/Debian systemd Installer
# Installs Node.js 22+ (if missing), clones/updates flop-kit into /opt/flop-kit,
# configures owner-only credentials in /etc/flop-kit/autopilot.env (chmod 600),
# and enables a lightweight (~40MB RAM) 24/7 systemd service.
# ==============================================================================
set -euo pipefail

REPO_URL="https://github.com/0xdead2026/flop-kit.git"
INSTALL_DIR="/opt/flop-kit"
ENV_DIR="/etc/flop-kit"
ENV_FILE="${ENV_DIR}/autopilot.env"
SERVICE_FILE="/etc/systemd/system/flop-kit-autopilot.service"
KEYS_DIR="${HOME}/.flop-kit/keys"
KEYSTORE_PATH="${KEYS_DIR}/agent-testnet.json"
POLL_INTERVAL="${FLOP_AUTOPILOT_INTERVAL:-600}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (or via: sudo bash scripts/install-systemd.sh)"
  exit 1
fi

echo "==> [1/5] Checking git, curl, and Node.js 22+..."
apt-get update -qq
apt-get install -y -qq git curl ca-certificates >/dev/null

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' || echo 0)"
fi

if [[ "${NODE_MAJOR}" -lt 22 ]]; then
  echo "==> Installing Node.js 22 LTS (required for official @flop-labs/cli@0.8.3)..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    Node.js: $(node -v) | npm: $(npm -v)"

echo "==> [2/5] Installing/updating flop-kit in ${INSTALL_DIR}..."
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "${INSTALL_DIR}" fetch --quiet origin main
  git -C "${INSTALL_DIR}" reset --hard --quiet origin/main
else
  git clone --quiet "${REPO_URL}" "${INSTALL_DIR}"
fi

echo "==> [3/5] Preparing keystore directory (${KEYS_DIR})..."
mkdir -p "${KEYS_DIR}"
chmod 700 "${KEYS_DIR}"

if [[ ! -f "${KEYSTORE_PATH}" ]]; then
  echo ""
  echo "WARNING: Keystore not found at ${KEYSTORE_PATH}"
  echo "  Option A (Recommended — keep your single test wallet, anti-sybil):"
  echo "    Copy your existing agent-testnet.json to ${KEYSTORE_PATH} (chmod 600)."
  echo "  Option B (Generate a brand-new sr25519 Testnet keystore on this VPS):"
  echo "    FLOP_KEYSTORE_PASSWORD='YOUR_PASSWORD' npx --yes --package @flop-labs/cli@0.8.3 flop keys generate --name flop-agent-testnet --type sr25519 --out ${KEYSTORE_PATH} --password-env FLOP_KEYSTORE_PASSWORD"
  echo ""
fi

echo "==> [4/5] Configuring owner-only environment file (${ENV_FILE})..."
mkdir -p "${ENV_DIR}"
chmod 700 "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cat > "${ENV_FILE}" <<EOF
# chmod 600 — keep private!
# Paste your agent-testnet.json password below to enable automatic 10 \$FLOP claims:
FLOP_KEYSTORE_PASSWORD=
EOF
  chmod 600 "${ENV_FILE}"
  echo "    Created ${ENV_FILE} (chmod 600). Edit it with: nano ${ENV_FILE}"
else
  chmod 600 "${ENV_FILE}"
  echo "    Preserving existing ${ENV_FILE}."
fi

echo "==> [5/5] Writing and enabling systemd unit (${SERVICE_FILE})..."
NODE_BIN="$(command -v node)"
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=flop-kit 24/7 FLOP Testnet Faucet & Activation Autopilot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=HOME=${HOME}
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/bin/flop-kit.js autopilot --interval ${POLL_INTERVAL} --keystore ${KEYSTORE_PATH}
Restart=always
RestartSec=30
MemoryMax=300M
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now flop-kit-autopilot.service

echo ""
echo "==================================================================="
echo " flop-kit-autopilot is ACTIVE (24/7)!"
echo " Live logs:    journalctl -u flop-kit-autopilot -f"
echo " Service info: systemctl status flop-kit-autopilot"
echo " Edit password: nano ${ENV_FILE} && systemctl restart flop-kit-autopilot"
echo "==================================================================="
