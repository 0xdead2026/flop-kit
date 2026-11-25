/**
 * Official verified Flop Labs / FLOP Network constants, domains, and protocol rules.
 * All values verified against official documentation:
 *   - https://flop.finance/official/
 *   - https://flop.finance/airdrop/
 *   - https://docs.flop.network/networks/testnet
 *   - https://docs.flop.network/testnet-validator-prep/
 */

export const OFFICIAL_CLI = Object.freeze({
  cliPackage: '@flop-labs/cli@0.8.3',
  sdkPackage: '@flop-labs/sdk@0.11.0',
  pythonSdkPackage: 'flop-sdk==0.3.2',
  minNodeMajor: 22,
  validatorNodeMajor: 24,
});

export const NETWORKS = Object.freeze({
  testnet: Object.freeze({
    id: 'testnet',
    chainId: 'flop_testnet',
    labelEn: 'FLOP Public Testnet',
    labelTr: 'FLOP Herkese Açık Testnet',
    rpcHttp: 'https://testnet.flop.network/',
    rpcWs: 'wss://testnet.flop.network/',
    expectedGenesis:
      '0x918abd58fb16306b30ef3886514cfaebffecb4de43e82b6f8ec4795c43cfd800',
    expectedChainSpecFile: 'flop_testnet-918abd58fb16306b.raw.json',
    expectedChainSpecSha256:
      '485ecb44635609ab261ea3002c3c9fdc7a5dab38caf28a86f654cadf443893be',
    explorer: 'https://testnet.flopscan.io/',
    faucet: 'https://faucet.flop.network/',
    scoredNoteEn:
      'Opening phase is UNSCORED. Earning begins only at the publicly announced finalized activation block (no backfill).',
    scoredNoteTr:
      'Açılış aşaması PUANSIZDIR (unscored). Puanlama yalnızca kamuya duyurulacak kesinleşmiş aktivasyon bloğunda başlar (geriye dönük sayım yoktur).',
  }),
  devnet: Object.freeze({
    id: 'devnet',
    chainId: 'flop_devnet',
    labelEn: 'FLOP Devnet (Practice / Zero Airdrop Weight)',
    labelTr: 'FLOP Devnet (Prova / 0 Airdrop Puanı)',
    rpcHttp: 'https://rpc.devnet.flop.network',
    rpcWs: 'wss://rpc.devnet.flop.network',
    expectedGenesis:
      '0x99c172c095340ace980631f9123544c6bebd4839f3437e463533422d8be2d631',
    explorer: 'https://explorer.devnet.flop.network/',
    faucet: 'https://faucet.devnet.flop.network/',
    gateway: 'https://api.flop.network',
    scoredNoteEn: 'Devnet is strictly for practice and carries ZERO airdrop credit.',
    scoredNoteTr: 'Devnet yalnızca prova içindir ve SIFIR airdrop puanı verir.',
  }),
});

export const OFFICIAL_LINKS = Object.freeze({
  website: 'https://flop.finance/',
  officialSecurity: 'https://flop.finance/official/',
  testnetPortal: 'https://flop.finance/testnet/',
  airdropRules: 'https://flop.finance/airdrop/',
  docs: 'https://docs.flop.network/',
  testnetDocs: 'https://docs.flop.network/networks/testnet',
  validatorPrep: 'https://docs.flop.network/testnet-validator-prep/',
  agentIntegration: 'https://docs.flop.network/docs/agent-integration',
  sdkRefs: 'https://docs.flop.network/docs/sdk-references',
  faucet: 'https://faucet.flop.network/',
  faucetDevnet: 'https://faucet.devnet.flop.network/',
  agentLlmsGuide: 'https://flop.network/llms.txt',
  explorerTestnet: 'https://testnet.flopscan.io/',
  explorerDevnet: 'https://explorer.devnet.flop.network/',
  gatewayApi: 'https://api.flop.network/v1',
  mcpEndpoint: 'https://mcp.flop.network/mcp',
  technocore: 'https://technocore.chat/',
  askBot: 'https://ask.flop.finance/',
  xOfficial: 'https://x.com/flop_labs',
  githubOrg: 'https://github.com/flop-labs',
  operatorApplication:
    'https://github.com/flop-labs/network/issues/new?template=operator-application.yml',
  minerApplication: 'https://flop.finance/apply/miner',
  kolApplication: 'https://flop.finance/apply/kol',
  hermesAgent: 'https://hermes-agent.nousresearch.com/',
  securityEmail: 'security@flop.finance',
});

/**
 * Strict domain allowlist verified from https://flop.finance/official/
 * Note: Flop Labs explicitly has NO official Discord, Telegram, Reddit, or Medium.
 */
export const OFFICIAL_ROOT_DOMAINS = Object.freeze([
  'flop.finance',
  'flop.network',
  'flopscan.io',
  'technocore.chat',
]);

export const OFFICIAL_SOCIAL_HANDLES = Object.freeze({
  x: 'https://x.com/flop_labs',
  youtube: 'https://www.youtube.com/@flop_labs',
  tiktok: 'https://www.tiktok.com/@flop_labs',
  githubPrefix: 'https://github.com/flop-labs',
});

export const FORBIDDEN_SCAM_CHANNELS = Object.freeze([
  'discord.gg',
  'discord.com',
  't.me',
  'telegram.me',
  'reddit.com',
  'medium.com',
]);

export const TOKENOMICS = Object.freeze({
  totalGenesisPool: 4_400_000_000,
  pools: Object.freeze({
    agents: 1_200_000_000,
    miners: 1_200_000_000,
    validators: 1_200_000_000,
    ecosystem: 800_000_000,
  }),
  agent: Object.freeze({
    tgeLiquidPct: 0,
    spendPerUnlock: 3, // Spend 3 locked FLOP on inference -> unlock 1 liquid FLOP
    maxLiquidPct: 0.25, // 1 / (3 + 1) = 25%
    computeBurnPct: 0.75,
  }),
  miner: Object.freeze({
    tgeLiquidPct: 0.25,
    lockedPct: 0.75,
    earnToUnlockRatio: 1, // 1:1 with mainnet earnings (rewards + fees)
  }),
  validator: Object.freeze({
    maxSeats: 1000,
    openingTargetSeats: 50,
    dailyGrowthPct: 25,
    fixedAllocationPerSeat: 1_200_000,
    halvingIntervals: 5,
    approxUnlockYears: 10,
  }),
});

export const HARDWARE_SPECS = Object.freeze({
  agent: Object.freeze({
    minCores: 2,
    minRamGb: 4,
    minDiskGb: 5,
    gpuRequired: false,
  }),
  validatorRehearsal: Object.freeze({
    minCores: 4,
    minRamGb: 16,
    minDiskGb: 300,
    gpuRequired: false,
  }),
  validatorProduction: Object.freeze({
    minCores: 8,
    minRamGb: 32,
    recommendedRamGb: 64,
    minDiskGb: 4000,
    gpuRequired: false,
    os: 'Linux amd64',
  }),
  miner: Object.freeze({
    minVramGb: 16,
    gpuVendor: 'NVIDIA',
    dockerRequired: true,
  }),
});
