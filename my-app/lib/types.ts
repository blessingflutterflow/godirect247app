import type { Timestamp } from 'firebase/firestore';

export interface Beneficiary {
  name: string;
  idNumber: string;
  relation: string;
}

export interface Spouse {
  firstName: string;
  surname: string;
  idNumber: string;
  cell: string;
}

export interface Dependent {
  name: string;
  relation: string;
  id: string;
}

export interface ExtendedFamily {
  name: string;
  idNumber: string;
}

export interface GiftFamily {
  fullName: string;
  phone: string;
  idNumber: string;
  relationship: string;
}

export interface UserData {
  id?: string;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  idNumber: string;
  employmentStatus: string;
  source: string;
  planType: 'plus' | 'gold';
  tier: string;
  referralCode: string;
  referredBy: string | null;
  referredByName: string;
  beneficiary: Beneficiary | null;
  spouse: Spouse | null;
  dependents: Dependent[];
  extendedFamily: ExtendedFamily | null;
  isActivated: boolean;
  totalPaid: number;
  totalEarnings?: number;
  activationDate: Timestamp | null;
  rewardReleaseDate: Timestamp | null;
  families: GiftFamily[];
  funeralCoverActive: boolean;
  funeralCoverExpiry: Timestamp | null;
  applicationStatus: string;
  status?: 'Active' | 'Pending' | 'Lapsed';
  createdAt?: Timestamp;
  shareCount?: number;
  shareEarnings?: number;
  lastShareDate?: Timestamp | null;
  dailyShareCount?: number;
  generosityStep?: number;
  harvestBalance?: number;
  trioMembers?: string[];
  trioId?: string | null;
  fundedBy?: string | null;
  downstreamRewards?: number;
  updatedAt?: Timestamp;
}

export interface Trio {
  id: string;
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  memberNames: string[];
  status: 'forming' | 'active' | 'complete';
  step: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  type: 'self' | 'family1' | 'family2';
  familyIndex?: number | null;
  status: 'pending' | 'paid';
  verifiedBy?: string | null;
  verifiedAt?: Timestamp | null;
  paidAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'joined' | 'paid' | 'tier_up' | 'reward_ready' | 'share_reward';
  message: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredUserName: string;
  status: 'signed_up' | 'paid';
  commissionAmount: number;
  paidAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface Reward {
  id: string;
  userId: string;
  cashbackAmount: number;
  bonusAmount: number;
  totalAmount: number;
  status: 'pending' | 'released';
  releaseDate: Timestamp;
  releasedAt: Timestamp | null;
  preLaunchSpecial?: boolean;
  referralCount?: number;
  createdAt: Timestamp;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  accountType: 'Cheque' | 'Savings';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Timestamp;
  processedAt: Timestamp | null;
  processedBy: string | null;
}

export interface SignUpFormData {
  fullName: string;
  phone: string;
  idNumber: string;
  employmentStatus: string;
  source: string;
  referredByName: string;
  planType: 'plus' | 'gold';
  tier: string;
  beneficiary: Beneficiary | null;
  spouse: Spouse | null;
  dependents: Dependent[];
  extendedFamily: ExtendedFamily | null;
}
