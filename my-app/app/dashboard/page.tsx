'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, User, Coins, Users, PhoneCall, ShareNetwork,
  CheckCircle, Warning, SignOut, TrendUp, Gift, UserPlus,
  CreditCard, ArrowRight, Copy, WhatsappLogo, Lock,
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth-context';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  logoutUser, markNotificationRead, formatDate,
  recordActivationPayment, getReferralStats, isCampaignActive,
  requestWithdrawal, getUserWithdrawal, recordLinkShare, upgradeGenerosityStep,
  getUserTrio,
} from '@/lib/firebase-service';
import type { ReferralStats } from '@/lib/firebase-service';
import type { Withdrawal, Trio } from '@/lib/types';
import type { AppNotification, UserData } from '@/lib/types';
import type { Timestamp } from 'firebase/firestore';
import { PLUS_TIERS, GOLD_TIERS, ACTIVATION_AMOUNT, SHARE_MIN_WITHDRAWAL, GENEROSITY_STEPS } from '@/lib/constants';


function toDate(value: Timestamp | null | undefined): Date | null {
  if (!value) return null;
  return typeof value.toDate === 'function' ? value.toDate() : new Date(value as unknown as string);
}

function localDate(value: Timestamp | null | undefined): string {
  const d = toDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getActivationFee(tierName: string, planType: 'plus' | 'gold'): number {
  const tiers = planType === 'gold' ? GOLD_TIERS : PLUS_TIERS;
  return tiers.find((t) => t.name === tierName)?.feeAmount ?? ACTIVATION_AMOUNT;
}

function TierProgressBar({ stats }: { stats: ReferralStats }) {
  const paid = stats.paid;
  let progress = 0;
  let nextAt: number | null = 1;

  if (paid >= 20) { progress = 100; nextAt = null; }
  else if (paid >= 10) { progress = Math.round(((paid - 10) / 10) * 100); nextAt = 20; }
  else if (paid >= 1) { progress = Math.round(((paid - 1) / 9) * 100); nextAt = 10; }

  return (
    <div>
      <div className="flex justify-between text-xs text-white/50 mb-1.5">
        <span>{stats.tier} Tier · R{stats.commissionRate}/referral</span>
        {nextAt
          ? <span>{paid}/{nextAt} to next tier</span>
          : <span className="text-[#f3cc20]">Max tier reached!</span>}
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-2 bg-gradient-to-r from-[#f3cc20] to-[#c9a800] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<Withdrawal | null>(null);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountNumber: '', accountHolder: '', accountType: 'Cheque' as 'Cheque' | 'Savings' });
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [userTrio, setUserTrio] = useState<Trio | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshUserData();
      getReferralStats(user.uid).then(setReferralStats);
      getUserWithdrawal(user.uid).then(setPendingWithdrawal);
      getUserTrio(user.uid).then(setUserTrio);
    }
  }, [user, refreshUserData]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.yoco.com/sdk/v1/yoco-sdk-web.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleMarkAllRead() {
    for (const n of notifications) await markNotificationRead(n.id);
    setNotifications([]);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await logoutUser();
    router.push('/');
  }

  function handleActivate() {
    if (!user || !userData) return;
    setActivationError('');
    const u = userData as UserData;
    const fee = getActivationFee(u.tier, u.planType);
    const amountInCents = fee * 100;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yoco = new (window as any).YocoSDK({
      publicKey: process.env.NEXT_PUBLIC_YOCO_PUBLIC_KEY,
    });

    yoco.showPopup({
      amountInCents,
      currency: 'ZAR',
      name: 'GoDirect247',
      description: `${u.tier} Cover Activation`,
      callback: async (result: { error?: { message: string }; id?: string }) => {
        if (result.error) {
          setActivationError(result.error.message);
          return;
        }
        setActivating(true);
        try {
          const res = await fetch('/api/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: result.id, amountInCents }),
          });
          const data = await res.json();
          if (!res.ok) {
            setActivationError(data.error || 'Payment failed. Please try again.');
          } else {
            await recordActivationPayment(user.uid, fee, data.chargeId);
            await Promise.all([
              refreshUserData(),
              getReferralStats(user.uid).then(setReferralStats),
            ]);
          }
        } catch {
          setActivationError('Something went wrong. Please contact support.');
        }
        setActivating(false);
      },
    });
  }

  async function handleWithdraw() {
    if (!user || !userData) return;
    setWithdrawError('');
    const { bankName, accountNumber, accountHolder, accountType } = bankDetails;
    if (!bankName || !accountNumber || !accountHolder) {
      setWithdrawError('Please fill in all bank details.');
      return;
    }
    const u = userData as UserData;
    const refEarnings = u.totalEarnings || 0;
    const shareEarnings = (u.shareEarnings || 0) >= SHARE_MIN_WITHDRAWAL ? (u.shareEarnings || 0) : 0;
    const amount = refEarnings + shareEarnings;

    if (amount <= 0) {
      if ((u.shareEarnings || 0) > 0 && (u.shareEarnings || 0) < SHARE_MIN_WITHDRAWAL) {
        setWithdrawError(`Link share earnings require a minimum of R${SHARE_MIN_WITHDRAWAL} to withdraw.`);
      }
      return;
    }
    setWithdrawing(true);
    const result = await requestWithdrawal(user.uid, u.fullName, amount, { bankName, accountNumber, accountHolder, accountType });
    if (!result.success) {
      setWithdrawError(result.error || 'Request failed.');
    } else {
      const w = await getUserWithdrawal(user.uid);
      setPendingWithdrawal(w);
      setShowWithdrawForm(false);
    }
    setWithdrawing(false);
  }

  function copyReferralLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    if (user) recordLinkShare(user.uid);
  }

  function handleShareClick() {
    if (user) recordLinkShare(user.uid);
  }

  async function handleUpgrade() {
    if (!user) return;
    const res = await upgradeGenerosityStep(user.uid);
    if (!res.success) alert(res.error);
    else refreshUserData();
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-[#191c1f] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-[#111315] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-white font-bold text-xl mb-2">Connection Issue</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs">
          We couldn't load your profile. This is usually due to a network issue or the database being offline.
        </p>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#f3cc20] text-dark font-bold px-6 py-2 rounded-full text-sm"
          >
            Retry
          </button>
          <button 
            onClick={handleSignOut}
            className="border border-white/10 text-white/40 px-6 py-2 rounded-full text-sm hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const u = userData as UserData;
  const activationDate = toDate(u.activationDate);
  const renewalDate = activationDate
    ? new Date(new Date(activationDate).setMonth(activationDate.getMonth() + 12))
    : null;

  let cashbackProgress = 0;
  let cashbackLabel = 'Not activated';
  let cashbackDateStr = '-';
  if (u.isActivated && activationDate) {
    const daysActive = Math.max(0, Math.floor((Date.now() - activationDate.getTime()) / 86400000));
    cashbackProgress = Math.min(100, Math.floor((daysActive / 120) * 100));
    cashbackLabel = `Day ${daysActive} of 120`;
    const cbDate = new Date(activationDate);
    cbDate.setMonth(cbDate.getMonth() + 3);
    cbDate.setDate(5);
    cashbackDateStr = cbDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const waitingEnd = activationDate
    ? new Date(new Date(activationDate).setMonth(activationDate.getMonth() + 6))
    : null;

  const familyMembers = [
    { name: `${u.fullName || 'You'} (main member)`, label: u.tier || 'Member' },
    ...(u.beneficiary?.name ? [{ name: u.beneficiary.name, label: `Beneficiary · ${u.beneficiary.relation || ''}` }] : []),
    ...(u.spouse?.firstName ? [{ name: `${u.spouse.firstName} ${u.spouse.surname || ''}`, label: 'Spouse' }] : []),
    ...(u.dependents || []).filter((d) => d.name).map((d) => ({ name: d.name, label: `Dependent · ${d.relation || 'Child'}` })),
    ...(u.extendedFamily?.name ? [{ name: u.extendedFamily.name, label: 'Extended family' }] : []),
  ];

  const iconMap: Record<string, React.ReactNode> = {
    joined: <UserPlus size={14} className="text-sky-300" />,
    paid: <Coins size={14} className="text-[#f3cc20]" />,
    tier_up: <TrendUp size={14} className="text-[#00a87e]" />,
    reward_ready: <Gift size={14} className="text-[#f3cc20]" />,
  };

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/signup?ref=${u.referralCode}`
    : `https://godirect247.co.za/signup?ref=${u.referralCode}`;

  const fee = getActivationFee(u.tier, u.planType);
  const campaignActive = isCampaignActive();

  const step1Done = u.isActivated;
  const step2Done = (referralStats?.paid ?? 0) >= 2;
  const rewardReleaseDate = toDate(u.rewardReleaseDate);
  const step3Done = !!(rewardReleaseDate && new Date() > rewardReleaseDate);

  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `I'm using GoDirect247 for affordable funeral cover + cashback rewards. Join using my link: ${referralLink}`
  )}`;

  return (
    <div className="bg-[#191c1f] min-h-screen text-white">

      {/* Top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#191c1f] border-b border-white/10 h-14 flex items-center px-5 gap-3">
        <div className="font-display font-extrabold text-white text-lg">
          Go<span className="text-[#f3cc20]">Direct</span>247
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <Bell size={14} className="text-white/70" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#e23b4a] rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {Math.min(notifications.length, 99)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#191c1f] border border-white/15 rounded-2xl shadow-2xl z-[100] max-h-80 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-white font-semibold text-sm">Notifications</span>
                  <button onClick={handleMarkAllRead} className="text-[#f3cc20] text-xs font-medium hover:text-[#f3cc20]/80">
                    Mark all read
                  </button>
                </div>
                <div className="overflow-y-auto max-h-64 px-3 py-2 space-y-1">
                  {notifications.length === 0 ? (
                    <p className="text-white/40 text-xs text-center py-6">No new notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {iconMap[n.type] ?? <Bell size={14} className="text-white/50" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs leading-relaxed">{n.message}</p>
                          <p className="text-white/30 text-[10px] mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                        <div className="w-2 h-2 bg-[#f3cc20] rounded-full flex-shrink-0 mt-2" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-8 h-8 rounded-full bg-[#f3cc20]/20 border border-[#f3cc20]/30 flex items-center justify-center">
            <User size={14} className="text-[#f3cc20]" />
          </div>
        </div>
      </nav>

      {notifOpen && <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />}

      <div className="pt-14 max-w-lg mx-auto px-4 py-6">
        {/* Greeting */}
        <div className="ani1 mb-6">
          <p className="text-white/40 text-sm">Welcome back,</p>
          <h1 className="font-display font-extrabold text-white text-2xl">
            {u.fullName || 'Member'}
          </h1>
        </div>

        {/* Activation card */}
        {!u.isActivated && (
          <div className="ani2 bg-[#f3cc20]/10 border border-[#f3cc20]/40 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f3cc20]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard size={20} className="text-[#f3cc20]" />
              </div>
              <div>
                <p className="font-display font-bold text-white text-base">Activate your cover</p>
                <p className="text-white/50 text-xs mt-0.5">
                  Pay R{fee.toLocaleString()} to start your {u.tier} funeral cover
                </p>
              </div>
            </div>
            {activationError && (
              <p className="text-[#e23b4a] text-xs mb-3 bg-[#e23b4a]/10 border border-[#e23b4a]/20 rounded-xl px-3 py-2">
                {activationError}
              </p>
            )}
            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full bg-[#f3cc20] text-[#191c1f] font-display font-bold py-3.5 rounded-xl hover:bg-[#c9a800] transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {activating ? 'Processing…' : (
                <>Activate Now — R{fee.toLocaleString()} <ArrowRight size={16} /></>
              )}
            </button>
            <p className="text-white/30 text-xs text-center mt-2">Secured by Yoco · Card payments accepted</p>
          </div>
        )}

        {/* Policy card */}
        <div className="ani2 bg-[#f3cc20] rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[#191c1f]/60 text-xs font-semibold uppercase tracking-wide">Your plan</p>
              <p className="font-display font-extrabold text-[#191c1f] text-xl mt-0.5">{u.tier || '-'}</p>
            </div>
            <span className="bg-[#191c1f]/15 text-[#191c1f] font-bold text-xs px-3 py-1.5 rounded-full">
              {u.isActivated ? 'Active' : 'Pending'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[#191c1f]/70 text-xs">
            <div>
              <p className="font-semibold text-[#191c1f]">{localDate(u.activationDate)}</p>
              <p>Activation date</p>
            </div>
            <div>
              <p className="font-semibold text-[#191c1f]">
                {renewalDate
                  ? renewalDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '-'}
              </p>
              <p>Renewal due</p>
            </div>
          </div>
        </div>

        {/* Cashback tracker */}
        <div className="ani2 bg-white/[0.05] border border-white/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins size={20} className="text-[#f3cc20]" />
              <span className="font-display font-bold text-white text-base">Cashback tracker</span>
            </div>
            <span className="text-white/40 text-xs">
              {u.planType ? `${u.planType.charAt(0).toUpperCase()}${u.planType.slice(1)} Plan` : '-'}
            </span>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-white/40 mb-1.5">
              <span>Progress to cashback</span>
              <span className="text-white font-semibold">{cashbackLabel}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-2 bg-[#f3cc20] rounded-full transition-all" style={{ width: `${cashbackProgress}%` }} />
            </div>
          </div>
          <p className="text-white/50 text-xs">
            First cashback on{' '}
            <span className="text-white font-semibold">{cashbackDateStr}</span>{' '}
            (5th of your 4th month)
          </p>
        </div>

          {/* Generosity Rewards Roadmap */}
          <div className="bg-gradient-to-br from-[#f3cc20]/20 to-transparent border border-[#f3cc20]/30 rounded-2xl p-5 mb-4 shadow-lg shadow-[#f3cc20]/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#f3cc20] flex items-center justify-center">
                <TrendUp size={18} weight="bold" className="text-dark" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-base leading-none">Steps To The Top</h3>
                <p className="text-[#f3cc20] text-[10px] font-bold uppercase tracking-widest mt-1">Generosity Roadmap</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-white/40 text-[10px] uppercase font-semibold mb-1">Current Status</p>
                  <p className="text-white font-display font-bold text-lg">{u.generosityStep ? GENEROSITY_STEPS[u.generosityStep - 1].name : 'Not Started'}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-[10px] uppercase font-semibold mb-1">Harvest Balance</p>
                  <p className="text-[#f3cc20] font-display font-bold text-2xl leading-none">R{(u.harvestBalance || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Team / Trio */}
              {userTrio && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-white/40 text-[10px] uppercase font-semibold mb-2">My Team</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#f3cc20]/20 flex items-center justify-center">
                      <User size={12} className="text-[#f3cc20]" />
                    </div>
                    <span className="text-white text-xs font-semibold">{userTrio.leaderName} (Leader)</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {userTrio.memberNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00a87e]" />
                        <span className="text-white/70 text-xs">{name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-white/30 text-[9px] mt-2">Team step: {userTrio.step} of 9</p>
                </div>
              )}

              {/* Downstream Rewards */}
              {(u.downstreamRewards || 0) > 0 && (
                <div className="bg-[#00a87e]/10 border border-[#00a87e]/20 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[#00a87e] text-[10px] uppercase font-semibold">Team Rewards</p>
                    <p className="text-white/60 text-[10px]">From members reaching Diamond Gold</p>
                  </div>
                  <p className="text-[#00a87e] font-display font-bold text-lg">R{(u.downstreamRewards || 0).toLocaleString()}</p>
                </div>
              )}

              {u.generosityStep !== undefined && u.generosityStep < GENEROSITY_STEPS.length && (
                <div className="pt-2">
                  <p className="text-white/60 text-xs mb-3 italic">
                    "Let us not become weary in doing good..."
                  </p>
                  <button 
                    onClick={handleUpgrade}
                    className="w-full bg-[#f3cc20] hover:bg-[#f3cc20]/90 text-dark font-display font-black py-3 rounded-xl transition-all shadow-xl shadow-[#f3cc20]/20 flex items-center justify-center gap-2"
                  >
                    <span>Seed {GENEROSITY_STEPS[u.generosityStep].name}</span>
                    <span className="text-[10px] bg-dark/10 px-2 py-0.5 rounded-md">R{GENEROSITY_STEPS[u.generosityStep].seed}</span>
                  </button>
                  <p className="text-white/30 text-[10px] text-center mt-2 uppercase tracking-tighter">
                    Move to the next level and increase your harvest
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Referral Hub Card */}

        {/* Referral Hub */}
        <div className="ani3 bg-white/[0.05] border border-white/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShareNetwork size={20} className="text-[#f3cc20]" />
              <span className="font-display font-bold text-white text-base">Referral Hub</span>
            </div>
            {campaignActive && (
              <span className="bg-[#00a87e]/20 text-[#00a87e] text-xs font-semibold px-2.5 py-1 rounded-full">
                Campaign live
              </span>
            )}
          </div>

          {/* Link row */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-w-0">
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Your link</p>
              <p className="text-white text-xs font-mono truncate">{referralLink}</p>
            </div>
            <button
              onClick={() => copyReferralLink(referralLink)}
              className="flex-shrink-0 w-10 h-10 mt-auto bg-white/10 border border-white/15 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all"
              title="Copy link"
            >
              {copied
                ? <CheckCircle size={16} className="text-[#00a87e]" />
                : <Copy size={16} className="text-white/60" />}
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleShareClick}
              className="flex-shrink-0 w-10 h-10 mt-auto bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl flex items-center justify-center hover:bg-[#25D366]/20 transition-all"
              title="Share on WhatsApp"
            >
              <WhatsappLogo size={16} className="text-[#25D366]" />
            </a>
          </div>

          {/* Generosity Reward Stats */}
          <div className="bg-[#f3cc20]/5 border border-[#f3cc20]/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-xs uppercase tracking-wider">Generosity Rewards</p>
              <span className="text-[#f3cc20] text-[10px] font-bold bg-[#f3cc20]/10 px-2 py-0.5 rounded-full">R0.10 per share</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-white/40 text-[10px] mb-0.5">Total Shares</p>
                <p className="font-display font-bold text-white text-xl leading-none">{u.shareCount || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-[10px] mb-0.5">Share Earnings</p>
                <p className="font-display font-bold text-[#f3cc20] text-xl leading-none">R{(u.shareEarnings || 0).toLocaleString()}</p>
              </div>
            </div>
            {u.shareEarnings && u.shareEarnings < SHARE_MIN_WITHDRAWAL ? (
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#f3cc20]/40 rounded-full" 
                  style={{ width: `${Math.min(100, (u.shareEarnings / SHARE_MIN_WITHDRAWAL) * 100)}%` }} 
                />
              </div>
            ) : null}
            {u.shareEarnings && u.shareEarnings < SHARE_MIN_WITHDRAWAL && (
              <p className="text-white/30 text-[9px] mt-1.5 text-center">
                R{SHARE_MIN_WITHDRAWAL} minimum withdrawal · R{(SHARE_MIN_WITHDRAWAL - u.shareEarnings).toFixed(2)} to go
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Referred', value: referralStats?.total ?? '—' },
              { label: 'Paid', value: referralStats?.paid ?? '—' },
              {
                label: 'Earned',
                value: referralStats != null ? `R${(referralStats.earnings || 0).toLocaleString()}` : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="font-display font-bold text-white text-lg">{value}</p>
                <p className="text-white/40 text-xs">{label}</p>
              </div>
            ))}
          </div>

          {/* Commission tier progress */}
          {referralStats && <TierProgressBar stats={referralStats} />}

          {/* Pre-Launch Special tracker */}
          {campaignActive && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Gift size={16} className="text-[#f3cc20]" />
                <p className="text-white font-semibold text-sm">Pre-Launch Special · R3,000 reward</p>
              </div>
              <div className="space-y-2.5">
                {[
                  {
                    label: 'You activated',
                    done: step1Done,
                    sub: step1Done ? localDate(u.activationDate) : 'Complete activation above',
                  },
                  {
                    label: '2 referrals activated',
                    done: step2Done,
                    sub: `${referralStats?.paid ?? 0}/2 paid`,
                  },
                  {
                    label: '6-week lock passed',
                    done: step3Done,
                    sub: rewardReleaseDate
                      ? localDate(u.rewardReleaseDate)
                      : 'Unlocks 6 weeks after activation',
                  },
                ].map(({ label, done, sub }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                        done ? 'bg-[#00a87e] text-white' : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {done ? <CheckCircle size={14} weight="fill" /> : <Lock size={12} />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${done ? 'text-white' : 'text-white/50'}`}>
                        {label}
                      </p>
                      <p className="text-white/30 text-[10px]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {step1Done && step2Done && step3Done && (
                <div className="mt-3 bg-[#00a87e]/10 border border-[#00a87e]/20 rounded-xl p-3 text-center">
                  <p className="text-[#00a87e] font-semibold text-sm">
                    All steps complete! Reward pending admin release.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Earnings & withdrawal */}
        {((u.totalEarnings || 0) > 0 || pendingWithdrawal) && (
          <div className="ani3 bg-white/[0.05] border border-white/10 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins size={20} className="text-[#00a87e]" />
                <span className="font-display font-bold text-white text-base">Your Earnings</span>
              </div>
              <div className="text-right">
                <span className="font-display font-bold text-[#f3cc20] text-xl block leading-none">
                  R{((u.totalEarnings || 0) + (u.shareEarnings || 0)).toLocaleString()}
                </span>
                <span className="text-white/30 text-[10px]">
                  R{u.totalEarnings || 0} Ref · R{u.shareEarnings || 0} Share
                </span>
              </div>
            </div>

            {pendingWithdrawal ? (
              <div className="bg-[#f3cc20]/10 border border-[#f3cc20]/20 rounded-xl p-3 text-center">
                <p className="text-[#f3cc20] text-xs font-semibold">Withdrawal pending admin approval</p>
                <p className="text-white/40 text-xs mt-0.5">R{pendingWithdrawal.amount} · {pendingWithdrawal.bankName}</p>
              </div>
            ) : !showWithdrawForm ? (
              <button
                onClick={() => { setShowWithdrawForm(true); setBankDetails(b => ({ ...b, accountHolder: u.fullName })); }}
                className="w-full bg-[#00a87e]/10 border border-[#00a87e]/20 text-[#00a87e] font-semibold text-sm py-3 rounded-xl hover:bg-[#00a87e]/20 transition-all"
              >
                Request Withdrawal
              </button>
            ) : (
              <div className="space-y-3">
                <select
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails((b) => ({ ...b, bankName: e.target.value }))}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-sm"
                >
                  <option value="" className="bg-[#191c1f]">Select bank…</option>
                  {['ABSA', 'Capitec', 'FNB', 'Nedbank', 'Standard Bank', 'TymeBank', 'African Bank', 'Other'].map((b) => (
                    <option key={b} value={b} className="bg-[#191c1f]">{b}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Account holder name"
                  value={bankDetails.accountHolder}
                  onChange={(e) => setBankDetails((b) => ({ ...b, accountHolder: e.target.value }))}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm"
                />
                <input
                  type="text"
                  placeholder="Account number"
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails((b) => ({ ...b, accountNumber: e.target.value }))}
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(['Cheque', 'Savings'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setBankDetails((b) => ({ ...b, accountType: t }))}
                      className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        bankDetails.accountType === t
                          ? 'bg-[#00a87e]/20 border-[#00a87e]/40 text-[#00a87e]'
                          : 'bg-white/5 border-white/15 text-white/50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {withdrawError && (
                  <p className="text-[#e23b4a] text-xs bg-[#e23b4a]/10 border border-[#e23b4a]/20 rounded-xl px-3 py-2">
                    {withdrawError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setShowWithdrawForm(false); setWithdrawError(''); }}
                    className="py-3 rounded-xl border border-white/15 text-white/50 text-sm hover:border-white/30 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    className="py-3 rounded-xl bg-[#00a87e] text-white font-bold text-sm hover:bg-[#008c69] transition-all disabled:opacity-60"
                  >
                    {withdrawing ? 'Submitting…' : `Withdraw R${((u.totalEarnings || 0) + ((u.shareEarnings || 0) >= SHARE_MIN_WITHDRAWAL ? (u.shareEarnings || 0) : 0)).toLocaleString()}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Family covered */}
        <div className="ani3 bg-white/[0.05] border border-white/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-sky-300" />
              <span className="font-display font-bold text-white text-base">Family covered</span>
            </div>
            <span className="bg-[#00a87e]/20 text-[#00a87e] text-xs font-semibold px-2.5 py-1 rounded-full">
              {familyMembers.length} members
            </span>
          </div>
          <div className="space-y-3">
            {familyMembers.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                    <User size={14} className="text-white/60" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{f.name}</p>
                    <p className="text-white/40 text-xs">{f.label}</p>
                  </div>
                </div>
                <CheckCircle size={18} className="text-[#00a87e]" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="ani4 grid grid-cols-2 gap-3 mb-4">
          <a
            href="tel:+27780187995"
            className="bg-white/[0.05] border border-white/10 rounded-2xl p-4 text-left hover:border-white/20 transition-all"
          >
            <PhoneCall size={24} className="text-sky-300 mb-3 block" />
            <p className="font-display font-bold text-white text-sm">Contact support</p>
            <p className="text-white/40 text-xs mt-0.5">+27 78 018 7995</p>
          </a>
          <button
            onClick={() => copyReferralLink(referralLink)}
            className="bg-white/[0.05] border border-white/10 rounded-2xl p-4 text-left hover:border-white/20 transition-all"
          >
            <ShareNetwork size={24} className="text-[#f3cc20] mb-3 block" />
            <p className="font-display font-bold text-white text-sm">Refer &amp; earn</p>
            <p className="text-white/40 text-xs mt-0.5">Copy referral link</p>
          </button>
        </div>

        {/* Waiting period */}
        {waitingEnd && (
          <div className="ani4 bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Warning size={20} className="text-[#f3cc20] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold text-sm mb-1">Waiting period active</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Your 6-month natural death waiting period ends on{' '}
                  <span className="text-white font-semibold">
                    {waitingEnd.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  . Accidental death is covered immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Referral code */}
        {u.referralCode && (
          <div className="ani4 bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1">Your referral code</p>
            <p className="text-[#f3cc20] font-display font-bold text-xl tracking-widest">{u.referralCode}</p>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full border border-white/10 text-white/40 text-sm py-3.5 rounded-xl hover:border-white/20 hover:text-white/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <SignOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
