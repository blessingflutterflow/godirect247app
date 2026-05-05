export const ACTIVATION_AMOUNT = 650;
export const TOTAL_ACTIVATION = 1950;
export const REWARD_CASHBACK = 1950;
export const REWARD_BONUS = 1050;
export const REWARD_TOTAL = 3000;
export const REWARD_DELAY_WEEKS = 6;
export const CAMPAIGN_END_DATE = new Date('2026-05-30T23:59:59');
export const SHARE_REWARD_AMOUNT = 0.10;
export const SHARE_MIN_WITHDRAWAL = 100;
export const MAX_DAILY_SHARES = 50;


export interface TierData {
  name: string;
  cover: string;
  coverAmount: number;
  fee: string;
  feeAmount: number;
  isTop?: boolean;
}

export const PLUS_TIERS: TierData[] = [
  { name: 'Silver Plus', cover: 'R10,000', coverAmount: 10000, fee: 'R650', feeAmount: 650 },
  { name: 'Gold Plus', cover: 'R15,000', coverAmount: 15000, fee: 'R950', feeAmount: 950 },
  { name: 'Diamond Plus', cover: 'R20,000', coverAmount: 20000, fee: 'R1,200', feeAmount: 1200 },
  { name: 'Premier Plus', cover: 'R25,000', coverAmount: 25000, fee: 'R1,700', feeAmount: 1700 },
  { name: 'Prestige Plus', cover: 'R25,000', coverAmount: 25000, fee: 'R2,200', feeAmount: 2200 },
  { name: 'King Plus', cover: 'R30,000', coverAmount: 30000, fee: 'R3,000', feeAmount: 3000 },
  { name: 'Superior Plus', cover: 'R60,000', coverAmount: 60000, fee: 'R3,000', feeAmount: 3000, isTop: true },
];

export const GOLD_TIERS: TierData[] = [
  { name: 'Silver Gold', cover: 'R10,000', coverAmount: 10000, fee: 'R1,550', feeAmount: 1550 },
  { name: 'Gold Gold', cover: 'R15,000', coverAmount: 15000, fee: 'R4,900', feeAmount: 4900 },
  { name: 'Diamond Gold', cover: 'R20,000', coverAmount: 20000, fee: 'R10,000', feeAmount: 10000 },
  { name: 'Premier Gold', cover: 'R25,000', coverAmount: 25000, fee: 'R15,000', feeAmount: 15000 },
  { name: 'Prestige Gold', cover: 'R25,000', coverAmount: 25000, fee: 'R20,000', feeAmount: 20000 },
  { name: 'King Gold', cover: 'R30,000', coverAmount: 30000, fee: 'R25,000', feeAmount: 25000 },
  { name: 'Superior Gold', cover: 'R60,000', coverAmount: 60000, fee: 'R40,000', feeAmount: 40000, isTop: true },
];

export interface GenerosityStep {
  name: string;
  seed: number;
  harvest: number;
  keep: number;
  description?: string;
}

export const GENEROSITY_STEPS: GenerosityStep[] = [
  { name: 'Silver Plan', seed: 650, harvest: 3000, keep: 0, description: 'The Beginning' },
  { name: 'Silver Gold Plan', seed: 1550, harvest: 9000, keep: 1450, description: 'Growth Phase' },
  { name: 'Gold Plan', seed: 4900, harvest: 10750, keep: 4100, description: 'Harvesting' },
  { name: 'Platinum Plan', seed: 10000, harvest: 20090, keep: 850, description: 'Solid Return' },
  { name: 'Diamond Gold', seed: 15000, harvest: 31890, keep: 5850, description: 'Diamond Status' },
  { name: 'Premier Gold', seed: 15000, harvest: 31890, keep: 5850, description: 'Premier Leadership' },
  { name: 'Prestige Gold', seed: 20000, harvest: 40090, keep: 11890, description: 'Prestige' },
  { name: 'King Gold', seed: 25000, harvest: 50890, keep: 15090, description: 'King Status' },
  { name: 'Superior Gold', seed: 40000, harvest: 100090, keep: 10890, description: 'The Top' },
];

