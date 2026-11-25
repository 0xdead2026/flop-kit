/**
 * Single source of truth for flop-kit branding and links.
 * Update GITHUB_USER and X_HANDLE before publishing to your own GitHub / X account.
 */
export const BRANDING = Object.freeze({
  toolName: 'flop-kit',
  version: '1.2.0',
  taglineEn: 'Zero-Dependency FLOP Network Testnet Cockpit & Mission Control',
  taglineTr: 'Bağımlılıksız FLOP Network Testnet Kokpiti & Kontrol Merkezi',
  authorDisplay: '0xdead',
  githubUser: '0xdead2026',
  repoName: 'flop-kit',
  xHandle: '@0Oxdead',
  get repoUrl() {
    return `https://github.com/${this.githubUser}/${this.repoName}`;
  },
  get xUrl() {
    const clean = this.xHandle.replace(/^@/, '');
    return `https://x.com/${clean}`;
  },
});
