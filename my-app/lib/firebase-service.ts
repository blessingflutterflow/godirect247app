import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserData, Payment, AppNotification, Referral, Reward, Withdrawal, SignUpFormData, Trio } from './types';
import { ACTIVATION_AMOUNT, TOTAL_ACTIVATION, REWARD_CASHBACK, REWARD_BONUS, REWARD_TOTAL, REWARD_DELAY_WEEKS, CAMPAIGN_END_DATE, SHARE_REWARD_AMOUNT, MAX_DAILY_SHARES, GENEROSITY_STEPS } from './constants';

// ── SMS helper ────────────────────────────────────────────────────────────────

function sendSMSNotification(to: string, message: string): void {
  if (typeof window === 'undefined' || !to) return;
  fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  }).catch(() => {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getCommissionRate(count: number): number {
  if (count >= 20) return 100;
  if (count >= 10) return 75;
  if (count >= 1) return 50;
  return 0;
}

function getTierLabel(count: number): string {
  if (count >= 20) return 'Platinum';
  if (count >= 10) return 'Gold';
  if (count >= 1) return 'Silver';
  return 'Starter';
}

export function formatDate(value: Timestamp | Date | null | undefined): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : value.toDate();
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function isCampaignActive(): boolean {
  return new Date() < CAMPAIGN_END_DATE;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUpUser(
  email: string,
  password: string,
  userData: SignUpFormData
): Promise<{ success: boolean; uid?: string; referralCode?: string; error?: string }> {
  try {
    if (!isCampaignActive()) {
      throw new Error('This special offer has ended. Please contact support.');
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    let referralCode = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const snap = await getDocs(
        query(collection(db, 'users'), where('referralCode', '==', referralCode), limit(1))
      );
      if (snap.empty) break;
      referralCode = generateReferralCode();
    }

    let referredBy: string | null = null;
    if (typeof window !== 'undefined') {
      const refCode =
        new URLSearchParams(window.location.search).get('ref') ||
        localStorage.getItem('referralCode');
      if (refCode) {
        const snap = await getDocs(
          query(collection(db, 'users'), where('referralCode', '==', refCode), limit(1))
        );
        if (!snap.empty && snap.docs[0].id !== uid) {
          referredBy = snap.docs[0].id;
        }
      }
    }

    const now = serverTimestamp();
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      fullName: userData.fullName,
      phone: userData.phone,
      idNumber: userData.idNumber,
      employmentStatus: userData.employmentStatus,
      source: userData.source,
      planType: userData.planType,
      tier: userData.tier,
      referralCode,
      referredBy,
      referredByName: userData.referredByName,
      beneficiary: userData.beneficiary,
      spouse: userData.spouse,
      dependents: userData.dependents,
      extendedFamily: userData.extendedFamily,
      isActivated: false,
      totalPaid: 0,
      activationDate: null,
      rewardReleaseDate: null,
      families: [],
      funeralCoverActive: false,
      funeralCoverExpiry: null,
      applicationStatus: 'submitted',
      createdAt: now,
      updatedAt: now,
    });

    if (referredBy) {
      await addDoc(collection(db, 'referrals'), {
        referrerId: referredBy,
        referredUserId: uid,
        referredUserName: userData.fullName,
        status: 'signed_up',
        commissionAmount: 0,
        paidAt: null,
        createdAt: now,
      });
      await createNotification(
        referredBy,
        'joined',
        `${userData.fullName || 'Someone'} joined using your referral link!`
      );
      const referrerSnap = await getDoc(doc(db, 'users', referredBy));
      if (referrerSnap.exists() && referrerSnap.data().phone) {
        sendSMSNotification(
          referrerSnap.data().phone as string,
          `GoDirect247: ${userData.fullName || 'Someone'} just joined using your referral link! Get them to activate and earn your commission.`
        );
      }
    }

    return { success: true, uid, referralCode };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, uid: cred.user.uid };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as UserData;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function getAllMembers(): Promise<{
  success: boolean;
  members?: (UserData & { id: string })[];
  error?: string;
}> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const members = snap.docs.map((d) => {
      const data = { id: d.id, ...d.data() } as UserData & { id: string };
      if (!data.status) data.status = data.isActivated ? 'Active' : 'Pending';
      return data;
    });
    return { success: true, members };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load members' };
  }
}

export async function getPendingPayments(): Promise<{
  success: boolean;
  payments?: Payment[];
  error?: string;
}> {
  try {
    const snap = await getDocs(
      query(collection(db, 'payments'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))
    );
    const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
    return { success: true, payments };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load payments' };
  }
}

export async function verifyPayment(
  paymentId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = serverTimestamp();
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) throw new Error('Payment not found');
    const payment = paymentSnap.data() as Payment;

    await updateDoc(paymentRef, { status: 'paid', verifiedBy: adminId, verifiedAt: now, paidAt: now });

    const userRef = doc(db, 'users', payment.userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const user = userSnap.data() as UserData;

    const newTotalPaid = (user.totalPaid || 0) + payment.amount;
    const updates: Record<string, unknown> = { totalPaid: newTotalPaid, updatedAt: now };

    const isSelfActivation = payment.type === 'self' && payment.amount >= ACTIVATION_AMOUNT;
    const isFullyPaid = newTotalPaid >= TOTAL_ACTIVATION && !user.isActivated;

    if ((isSelfActivation || isFullyPaid) && !user.isActivated) {
      const rewardDate = new Date();
      rewardDate.setDate(rewardDate.getDate() + REWARD_DELAY_WEEKS * 7);
      const rewardTs = Timestamp.fromDate(rewardDate);
      const coverExpiry = new Date();
      coverExpiry.setMonth(coverExpiry.getMonth() + 12);

      updates.isActivated = true;
      updates.activationDate = now;
      updates.rewardReleaseDate = rewardTs;
      updates.funeralCoverActive = true;
      updates.funeralCoverExpiry = Timestamp.fromDate(coverExpiry);

      if (isFullyPaid) {
        await setDoc(doc(db, 'rewards', payment.userId), {
          userId: payment.userId,
          cashbackAmount: REWARD_CASHBACK,
          bonusAmount: REWARD_BONUS,
          totalAmount: REWARD_TOTAL,
          status: 'pending',
          releaseDate: rewardTs,
          releasedAt: null,
          createdAt: now,
        });
        await createNotification(payment.userId, 'reward_ready', `Your R${REWARD_TOTAL} reward is scheduled for ${formatDate(rewardDate)}.`);
      }
      await checkAndAwardPreLaunchReward(payment.userId);
    }

    await updateDoc(userRef, updates);

    if (user.referredBy) {
      await creditReferrerCommission(user.referredBy, payment.userId, payment.amount);
      await checkAndAwardPreLaunchReward(user.referredBy);
      await checkAllGenerosityMilestones(user.referredBy);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Verify failed' };
  }
}

export async function updateMemberStatus(
  memberId: string,
  status: 'Active' | 'Pending' | 'Lapsed'
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, 'users', memberId), {
      isActivated: status === 'Active',
      status,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
  }
}

export async function recordActivationPayment(
  uid: string,
  amount: number,
  chargeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = serverTimestamp();

    await addDoc(collection(db, 'payments'), {
      userId: uid,
      amount,
      type: 'self',
      status: 'paid',
      yocoChargeId: chargeId,
      createdAt: now,
      paidAt: now,
    });

    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new Error('User not found');
    const user = userSnap.data() as UserData;

    const rewardDate = new Date();
    rewardDate.setDate(rewardDate.getDate() + REWARD_DELAY_WEEKS * 7);
    const coverExpiry = new Date();
    coverExpiry.setMonth(coverExpiry.getMonth() + 12);

    await updateDoc(doc(db, 'users', uid), {
      isActivated: true,
      activationDate: now,
      totalPaid: (user.totalPaid || 0) + amount,
      rewardReleaseDate: Timestamp.fromDate(rewardDate),
      funeralCoverActive: true,
      funeralCoverExpiry: Timestamp.fromDate(coverExpiry),
      updatedAt: now,
    });

    if (user.referredBy) {
      await creditReferrerCommission(user.referredBy, uid, amount);
      await checkAndAwardPreLaunchReward(user.referredBy);
      await checkAllGenerosityMilestones(user.referredBy);
    }

    await checkAndAwardPreLaunchReward(uid);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Activation failed' };
  }
}

export interface ReferralStats {
  total: number;
  paid: number;
  earnings: number;
  tier: string;
  commissionRate: number;
  nextTierAt: number | null;
}

export async function getReferralStats(uid: string): Promise<ReferralStats> {
  const [allSnap, paidSnap, userSnap] = await Promise.all([
    getDocs(query(collection(db, 'referrals'), where('referrerId', '==', uid))),
    getDocs(query(collection(db, 'referrals'), where('referrerId', '==', uid), where('status', '==', 'paid'))),
    getDoc(doc(db, 'users', uid)),
  ]);

  const total = allSnap.size;
  const paid = paidSnap.size;
  const earnings = userSnap.exists() ? ((userSnap.data().totalEarnings as number) || 0) : 0;

  let tier = 'Starter';
  let commissionRate = 0;
  let nextTierAt: number | null = 1;

  if (paid >= 20) { tier = 'Platinum'; commissionRate = 100; nextTierAt = null; }
  else if (paid >= 10) { tier = 'Gold'; commissionRate = 75; nextTierAt = 20; }
  else if (paid >= 1) { tier = 'Silver'; commissionRate = 50; nextTierAt = 10; }

  return { total, paid, earnings, tier, commissionRate, nextTierAt };
}

export async function getAllRewards(): Promise<Reward[]> {
  const snap = await getDocs(query(collection(db, 'rewards'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reward));
}

export async function getAllReferrals(): Promise<Referral[]> {
  const snap = await getDocs(query(collection(db, 'referrals'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Referral));
}

// ── Withdrawals ───────────────────────────────────────────────────────────────

export async function requestWithdrawal(
  uid: string,
  userName: string,
  amount: number,
  bankDetails: { bankName: string; accountNumber: string; accountHolder: string; accountType: 'Cheque' | 'Savings' }
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getDocs(
      query(collection(db, 'withdrawals'), where('userId', '==', uid), where('status', '==', 'pending'), limit(1))
    );
    if (!existing.empty) return { success: false, error: 'You already have a pending withdrawal request.' };

    await addDoc(collection(db, 'withdrawals'), {
      userId: uid,
      userName,
      amount,
      ...bankDetails,
      status: 'pending',
      requestedAt: serverTimestamp(),
      processedAt: null,
      processedBy: null,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Request failed' };
  }
}

export async function getUserWithdrawal(uid: string): Promise<Withdrawal | null> {
  const snap = await getDocs(
    query(collection(db, 'withdrawals'), where('userId', '==', uid), where('status', '==', 'pending'), limit(1))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Withdrawal;
}

export async function getAllWithdrawals(): Promise<{ success: boolean; withdrawals?: Withdrawal[]; error?: string }> {
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc')));
    return { success: true, withdrawals: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Withdrawal)) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function processWithdrawal(
  withdrawalId: string,
  action: 'approved' | 'rejected',
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = serverTimestamp();
    const wRef = doc(db, 'withdrawals', withdrawalId);
    const wSnap = await getDoc(wRef);
    if (!wSnap.exists()) throw new Error('Withdrawal not found');
    const w = wSnap.data() as Withdrawal;

    await updateDoc(wRef, { status: action, processedAt: now, processedBy: adminId });

    if (action === 'approved') {
      const userSnap = await getDoc(doc(db, 'users', w.userId));
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserData;
        const currentRefEarnings = userData.totalEarnings || 0;
        const currentShareEarnings = userData.shareEarnings || 0;

        let remainingToDeduct = w.amount;
        const deductRef = Math.min(currentRefEarnings, remainingToDeduct);
        remainingToDeduct -= deductRef;
        const deductShare = Math.min(currentShareEarnings, remainingToDeduct);

        await updateDoc(doc(db, 'users', w.userId), {
          totalEarnings: Math.max(0, currentRefEarnings - deductRef),
          shareEarnings: Math.max(0, currentShareEarnings - deductShare),
          updatedAt: now,
        });

        sendSMSNotification(
          userSnap.data().phone as string,
          `GoDirect247: Your R${w.amount} withdrawal has been approved! Funds will be transferred to your ${w.bankName} account within 1-3 business days.`
        );
      }
      await createNotification(w.userId, 'paid', `Your withdrawal of R${w.amount} was approved! Funds will be transferred to your account.`);
    } else {
      const userSnap = await getDoc(doc(db, 'users', w.userId));
      if (userSnap.exists() && userSnap.data().phone) {
        sendSMSNotification(
          userSnap.data().phone as string,
          `GoDirect247: Your R${w.amount} withdrawal was not approved. Please contact us on 078 018 7995 for assistance.`
        );
      }
      await createNotification(w.userId, 'paid', `Your withdrawal of R${w.amount} was not approved. Please contact support.`);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Process failed' };
  }
}

export async function releaseReward(
  rewardId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = serverTimestamp();
    const rRef = doc(db, 'rewards', rewardId);
    const rSnap = await getDoc(rRef);
    if (!rSnap.exists()) throw new Error('Reward not found');
    const r = rSnap.data() as Reward;
    await updateDoc(rRef, { status: 'released', releasedAt: now, releasedBy: adminId });
    await createNotification(r.userId, 'reward_ready', `Your R${r.totalAmount} Pre-Launch Special reward has been released!`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Release failed' };
  }
}

export async function recordLinkShare(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const user = userSnap.data() as UserData;

    const now = new Date();
    const todayStr = now.toDateString();
    const lastShareTs = user.lastShareDate;
    const lastShareDate = lastShareTs ? (typeof lastShareTs.toDate === 'function' ? lastShareTs.toDate() : new Date(lastShareTs as unknown as string)) : null;
    const lastShareStr = lastShareDate ? lastShareDate.toDateString() : '';

    const dailyCount = (lastShareStr === todayStr) ? (user.dailyShareCount || 0) : 0;

    if (dailyCount >= MAX_DAILY_SHARES) {
      return { success: false, error: 'Daily share limit reached.' };
    }

    const newShareCount = (user.shareCount || 0) + 1;
    const newShareEarnings = (user.shareEarnings || 0) + SHARE_REWARD_AMOUNT;

    await updateDoc(userRef, {
      shareCount: newShareCount,
      shareEarnings: newShareEarnings,
      dailyShareCount: dailyCount + 1,
      lastShareDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to record share' };
  }
}


export async function checkAllGenerosityMilestones(uid: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const user = userSnap.data() as UserData;
    const currentStep = user.generosityStep || 0;

    // Count paid referrals
    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', uid),
      where('status', '==', 'paid')
    );
    const snap = await getDocs(q);
    const paidCount = snap.size;

    // Step 1: Silver Plan — 2 paid referrals → R3,000
    if (paidCount >= 2 && currentStep === 0) {
      const reward = GENEROSITY_STEPS[0].harvest;
      await updateDoc(userRef, {
        generosityStep: 1,
        harvestBalance: (user.harvestBalance || 0) + reward,
        updatedAt: serverTimestamp(),
      });
      await createNotification(uid, 'reward_ready', `Congratulations! Your Silver Plan harvest of R${reward.toLocaleString()} is ready.`);
      // Try auto-create trio if not in one
      await tryCreateTrio(uid);
    }

    // Steps 2-9: Each step requires the user to have upgraded to the previous step
    // and paid referrals at the threshold. For simplicity, after Step 1,
    // each upgrade is user-initiated via upgradeGenerosityStep().
    // Admin can also manually verify team completions.
  } catch (err) {
    console.error('Generosity milestone check failed:', err);
  }
}

export async function tryCreateTrio(leaderId: string): Promise<{ success: boolean; trioId?: string; error?: string }> {
  try {
    const leaderRef = doc(db, 'users', leaderId);
    const leaderSnap = await getDoc(leaderRef);
    if (!leaderSnap.exists()) return { success: false, error: 'Leader not found' };
    const leader = leaderSnap.data() as UserData;
    if (leader.trioId) return { success: true, trioId: leader.trioId };

    // Find 2 paid referrals
    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', leaderId),
      where('status', '==', 'paid'),
      limit(2)
    );
    const snap = await getDocs(q);
    if (snap.size < 2) return { success: false, error: 'Need 2 paid referrals to form a trio' };

    const memberIds = snap.docs.map((d) => d.data().referredUserId as string);
    const memberNames: string[] = [];
    for (const mid of memberIds) {
      const mSnap = await getDoc(doc(db, 'users', mid));
      memberNames.push(mSnap.exists() ? (mSnap.data().fullName as string) || 'Unknown' : 'Unknown');
    }

    const now = serverTimestamp();
    const trioRef = doc(collection(db, 'trios'));
    const trioId = trioRef.id;

    await setDoc(trioRef, {
      leaderId,
      leaderName: leader.fullName || 'Unknown',
      memberIds,
      memberNames,
      status: 'active',
      step: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Link all members to the trio
    await updateDoc(leaderRef, { trioId, updatedAt: now });
    for (const mid of memberIds) {
      await updateDoc(doc(db, 'users', mid), { trioId, fundedBy: leaderId, updatedAt: now });
    }

    await createNotification(leaderId, 'reward_ready', `Your trio is formed with ${memberNames.join(' & ')}! Step 1 unlocked.`);
    return { success: true, trioId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Trio creation failed' };
  }
}

export async function getUserTrio(uid: string): Promise<Trio | null> {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    const user = userSnap.data() as UserData;
    if (!user.trioId) return null;
    const trioSnap = await getDoc(doc(db, 'trios', user.trioId));
    if (!trioSnap.exists()) return null;
    return { id: trioSnap.id, ...trioSnap.data() } as Trio;
  } catch {
    return null;
  }
}

export async function getAllTrios(): Promise<{ success: boolean; trios?: Trio[]; error?: string }> {
  try {
    const snap = await getDocs(query(collection(db, 'trios'), orderBy('createdAt', 'desc')));
    const trios = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trio));
    return { success: true, trios };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load trios' };
  }
}

export async function awardDownstreamReward(userId: string, newStep: number): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const user = userSnap.data() as UserData;
    const funderId = user.fundedBy;
    if (!funderId) return;

    // Reward funder when funded member reaches Diamond Gold (Step 5) or higher
    if (newStep === 5) {
      const funderRef = doc(db, 'users', funderId);
      const funderSnap = await getDoc(funderRef);
      if (!funderSnap.exists()) return;
      const funder = funderSnap.data() as UserData;
      const reward = 2500;
      await updateDoc(funderRef, {
        downstreamRewards: (funder.downstreamRewards || 0) + reward,
        totalEarnings: (funder.totalEarnings || 0) + reward,
        updatedAt: serverTimestamp(),
      });
      await createNotification(funderId, 'paid', `R${reward.toLocaleString()} earned! ${user.fullName || 'Your team member'} reached Diamond Gold Status.`);
      sendSMSNotification(
        funder.phone as string,
        `GoDirect247: R${reward.toLocaleString()} earned! ${user.fullName || 'A team member'} reached Diamond Gold Status. Keep leading!`
      );
    }
  } catch (err) {
    console.error('Downstream reward failed:', err);
  }
}

export async function upgradeGenerosityStep(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('User not found');
    const user = userSnap.data() as UserData;

    const currentStep = user.generosityStep || 0;
    if (currentStep >= GENEROSITY_STEPS.length) throw new Error('You have reached the top!');

    const nextStepConfig = GENEROSITY_STEPS[currentStep]; // The step the user wants to join
    const harvestAvailable = user.harvestBalance || 0;

    if (harvestAvailable < nextStepConfig.seed) {
      throw new Error(`Insufficient harvest balance to seed ${nextStepConfig.name}. Requires R${nextStepConfig.seed}.`);
    }

    const newStep = currentStep + 1;
    const newHarvest = harvestAvailable - nextStepConfig.seed;
    const keepAmount = nextStepConfig.keep ?? 0;

    await updateDoc(userRef, {
      generosityStep: newStep,
      harvestBalance: newHarvest,
      totalEarnings: (user.totalEarnings || 0) + keepAmount,
      updatedAt: serverTimestamp(),
    });

    // Update trio step if leader
    if (user.trioId) {
      const trioRef = doc(db, 'trios', user.trioId);
      const trioSnap = await getDoc(trioRef);
      if (trioSnap.exists()) {
        const trio = trioSnap.data() as Trio;
        if (trio.leaderId === uid) {
          await updateDoc(trioRef, { step: newStep, updatedAt: serverTimestamp() });
        }
      }
    }

    // Notify downstream funder if milestone reached
    await awardDownstreamReward(uid, newStep);

    await createNotification(
      uid,
      'tier_up',
      `You have progressed to ${nextStepConfig.name}! Harvest: R${nextStepConfig.harvest.toLocaleString()}.`
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upgrade failed' };
  }
}

export async function createNotification(
  userId: string,
  type: AppNotification['type'],
  message: string
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function getUnreadNotifications(userId: string): Promise<{
  success: boolean;
  notifications?: AppNotification[];
  count?: number;
  error?: string;
}> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(20)
      )
    );
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
    return { success: true, notifications, count: notifications.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function creditReferrerCommission(
  referrerId: string,
  referredUserId: string,
  _amount: number
): Promise<void> {
  const now = serverTimestamp();
  const paidSnap = await getDocs(
    query(collection(db, 'referrals'), where('referrerId', '==', referrerId), where('status', '==', 'paid'))
  );
  const paidCount = paidSnap.size;
  const commissionAmount = getCommissionRate(paidCount + 1);

  const referralQuery = await getDocs(
    query(
      collection(db, 'referrals'),
      where('referrerId', '==', referrerId),
      where('referredUserId', '==', referredUserId),
      limit(1)
    )
  );
  if (!referralQuery.empty) {
    await updateDoc(referralQuery.docs[0].ref, { status: 'paid', commissionAmount, paidAt: now, updatedAt: now });
  }

  const referrerSnap = await getDoc(doc(db, 'users', referrerId));
  if (referrerSnap.exists()) {
    const referrerData = referrerSnap.data() as UserData;
    await updateDoc(doc(db, 'users', referrerId), {
      totalEarnings: (referrerData.totalEarnings || 0) + commissionAmount,
      updatedAt: now,
    });
    await createNotification(referrerId, 'paid', `You earned R${commissionAmount}! A referral paid their activation fee.`);
    sendSMSNotification(
      referrerData.phone as string,
      `GoDirect247: R${commissionAmount} earned! A referral just activated their policy. Log in to track your earnings.`
    );
    if (getCommissionRate(paidCount + 1) > getCommissionRate(paidCount)) {
      await createNotification(
        referrerId,
        'tier_up',
        `Commission tier increased! You now earn R${getCommissionRate(paidCount + 1)} per signup (${getTierLabel(paidCount + 1)} Tier).`
      );
      sendSMSNotification(
        referrerData.phone as string,
        `GoDirect247: You've reached ${getTierLabel(paidCount + 1)} tier! You now earn R${getCommissionRate(paidCount + 1)} per referral activation.`
      );
    }
  }
}

async function checkAndAwardPreLaunchReward(userId: string): Promise<void> {
  const existing = await getDoc(doc(db, 'rewards', userId));
  if (existing.exists()) return;

  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;
  const user = userSnap.data() as UserData;
  if (!user.isActivated) return;

  const paidSnap = await getDocs(
    query(collection(db, 'referrals'), where('referrerId', '==', userId), where('status', '==', 'paid'))
  );
  if (paidSnap.size < 2) return;

  const rewardDate = new Date();
  rewardDate.setDate(rewardDate.getDate() + REWARD_DELAY_WEEKS * 7);
  const now = serverTimestamp();

  await setDoc(doc(db, 'rewards', userId), {
    userId,
    cashbackAmount: REWARD_CASHBACK,
    bonusAmount: REWARD_BONUS,
    totalAmount: REWARD_TOTAL,
    status: 'pending',
    releaseDate: Timestamp.fromDate(rewardDate),
    releasedAt: null,
    preLaunchSpecial: true,
    referralCount: paidSnap.size,
    createdAt: now,
  });
  await createNotification(
    userId,
    'reward_ready',
    `Your R${REWARD_TOTAL} Pre-Launch Special reward is scheduled for ${formatDate(rewardDate)}.`
  );
}
