/**
 * FLOP Network Airdrop & Mainnet Unlock Math Simulator.
 * Implements ratified unlock mechanics from https://flop.finance/airdrop/
 * and https://docs.flop.network/docs/airdrop-and-testnet-conversion.
 */
import { askLine, c, drawBox, formatNum } from '../ansi.js';
import { TOKENOMICS } from '../constants.js';
import { t } from '../i18n.js';

export function calculateAgentUnlock(allocation) {
  const total = Math.max(0, Number(allocation) || 0);
  const maxLiquid = total * TOKENOMICS.agent.maxLiquidPct; // 25%
  const computeConsumed = total * TOKENOMICS.agent.computeBurnPct; // 75%
  return {
    role: 'agent',
    allocation: total,
    tgeLiquid: 0,
    computeConsumed,
    maxLiquid,
    ratioText: '3 locked FLOP spent on mainnet inference -> 1 liquid FLOP unlocked',
  };
}

export function calculateMinerUnlock(allocation) {
  const total = Math.max(0, Number(allocation) || 0);
  const tgeLiquid = total * TOKENOMICS.miner.tgeLiquidPct; // 25%
  const lockedEarnToUnlock = total * TOKENOMICS.miner.lockedPct; // 75%
  return {
    role: 'miner',
    allocation: total,
    tgeLiquid,
    lockedEarnToUnlock,
    mainnetEarningsRequiredForFullUnlock: lockedEarnToUnlock,
    usableAsStake: true,
  };
}

export function calculateValidatorUnlock(seats = 1) {
  const count = Math.max(1, Math.floor(Number(seats) || 1));
  const total = count * TOKENOMICS.validator.fixedAllocationPerSeat;
  const years = TOKENOMICS.validator.approxUnlockYears;
  return {
    role: 'validator',
    seats: count,
    allocation: total,
    tgeLiquid: 0,
    halvingIntervals: TOKENOMICS.validator.halvingIntervals,
    approxUnlockYears: years,
    approxYearlyLinearUnlock: total / years,
    note: 'Remains bonded as validator stake while holding a seat.',
  };
}

export async function runCalculator(lang = 'en', options = {}) {
  const isTr = lang === 'tr';

  if (options.role) {
    const role = String(options.role).toLowerCase();
    const amount = Number(options.amount) || (role === 'validator' ? 1 : 10000);
    const result =
      role === 'agent'
        ? calculateAgentUnlock(amount)
        : role === 'miner'
          ? calculateMinerUnlock(amount)
          : calculateValidatorUnlock(amount);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    printCalcResult(result, lang);
    return result;
  }

  console.log('');
  console.log(
    drawBox(
      t(lang, 'calc.title'),
      [
        c.gray(t(lang, 'calc.note')),
        '',
        `• Total Genesis Airdrop: ${c.brightCyan(formatNum(TOKENOMICS.totalGenesisPool) + ' $FLOP')} (0% VC, 0% Presale)`,
        `• Agents: ${c.green('1.2B')}  |  Miners: ${c.magenta('1.2B')}  |  Validators: ${c.yellow('1.2B')}  |  Ecosystem: ${c.cyan('800M')}`,
      ],
      { borderColor: c.cyan }
    )
  );

  const roleChoice = await askLine('\n' + c.brightCyan(t(lang, 'calc.promptRole')));
  if (roleChoice === '0' || !roleChoice) return;

  if (roleChoice === '1') {
    const amt = Number(await askLine(c.white(t(lang, 'calc.promptAmount')))) || 10000;
    printCalcResult(calculateAgentUnlock(amt), lang);
  } else if (roleChoice === '2') {
    const amt = Number(await askLine(c.white(t(lang, 'calc.promptAmount')))) || 10000;
    printCalcResult(calculateMinerUnlock(amt), lang);
  } else if (roleChoice === '3') {
    const seats =
      Number(
        await askLine(
          c.white(isTr ? 'Kaç validatör koltuğu? (varsayılan 1): ' : 'Number of validator seats? (default 1): ')
        )
      ) || 1;
    printCalcResult(calculateValidatorUnlock(seats), lang);
  }
}

function printCalcResult(res, lang) {
  const isTr = lang === 'tr';
  if (res.role === 'agent') {
    console.log(
      drawBox(
        isTr ? 'AGENT AİRDROP SONUCU (3:1 KURALI)' : 'AGENT AIRDROP BREAKDOWN (3:1 RULE)',
        [
          `${isTr ? 'Toplam Tahsis' : 'Total Allocation'}:          ${c.brightCyan(formatNum(res.allocation) + ' $FLOP')}`,
          `${isTr ? 'TGE Anında Likit' : 'Liquid at TGE'}:             ${c.red('0 $FLOP (0%)')}`,
          `${isTr ? 'Inference İçin Tüketilen' : 'Consumed for Inference'}:    ${c.yellow(formatNum(res.computeConsumed) + ' $FLOP (75%)')}`,
          `${isTr ? 'Maksimum Likit Açılım' : 'Max Liquid Unlocked'}:       ${c.brightGreen(formatNum(res.maxLiquid) + ' $FLOP (25%)')}`,
          '',
          c.gray(
            isTr
              ? 'Not: Harcama kendi kilitli airdrop bakiyenden düşer (cebinden nakit çıkmaz), ancak nakde dönebilen kısım max %25.'
              : 'Note: Inference spend comes out of your locked airdrop grant (no cash needed), capping liquid payout at 25%.'
          ),
        ],
        { borderColor: c.green }
      )
    );
  } else if (res.role === 'miner') {
    console.log(
      drawBox(
        isTr ? 'MINER AİRDROP SONUCU (%25 TGE + 1:1)' : 'MINER AIRDROP BREAKDOWN (25% TGE + 1:1)',
        [
          `${isTr ? 'Toplam Tahsis' : 'Total Allocation'}:          ${c.brightCyan(formatNum(res.allocation) + ' $FLOP')}`,
          `${isTr ? 'TGE Anında Likit' : 'Liquid at Genesis'}:         ${c.brightGreen(formatNum(res.tgeLiquid) + ' $FLOP (25%)')}`,
          `${isTr ? 'Kilitli (1:1 Kazançla Açılan)' : 'Locked (1:1 Earn-to-Unlock)'}: ${c.yellow(formatNum(res.lockedEarnToUnlock) + ' $FLOP (75%)')}`,
          `${isTr ? 'Tam Açılım İçin Mainnet Kazancı' : 'Mainnet Earnings Needed'}:   ${c.white(formatNum(res.mainnetEarningsRequiredForFullUnlock) + ' $FLOP')}`,
          c.gray(
            isTr
              ? 'Not: Kilitli bakiye mainnet üzerinde miner stake olarak kullanılabilir.'
              : 'Note: Locked balance can be posted as miner stake on mainnet.'
          ),
        ],
        { borderColor: c.magenta }
      )
    );
  } else {
    console.log(
      drawBox(
        isTr ? 'VALIDATOR AİRDROP SONUCU (~10 YIL BOND)' : 'VALIDATOR AIRDROP BREAKDOWN (~10Y BOND)',
        [
          `${isTr ? 'Koltuk Sayısı' : 'Seats'}:                      ${c.white(formatNum(res.seats))}`,
          `${isTr ? 'Toplam Tahsis (Sabit)' : 'Total Allocation (Fixed)'}:   ${c.brightCyan(formatNum(res.allocation) + ' $FLOP')}`,
          `${isTr ? 'TGE Anında Likit' : 'Liquid at TGE'}:              ${c.red('0 $FLOP (Bonded as stake)')}`,
          `${isTr ? 'Açılım Süresi' : 'Unlock Horizon'}:             ${c.yellow(`~${res.approxUnlockYears} years (${res.halvingIntervals} halving intervals)`)}`,
          `${isTr ? 'Yıllık Ort. Doğrusal Açılım' : 'Approx. Linear / Year'}:      ${c.white(formatNum(res.approxYearlyLinearUnlock) + ' $FLOP/yr')}`,
          c.gray(
            isTr
              ? 'Not: Koltuk elde tutulduğu sürece bond kilitli kalır; offline %1-5, hile %100 slash edilir.'
              : 'Note: Remains bonded while holding a seat; liveness slash 1-5%, fraud slash 100% + blacklist.'
          ),
        ],
        { borderColor: c.yellow }
      )
    );
  }
}
