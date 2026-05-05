'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { MagnifyingGlass, X, SignOut, TrendUp } from '@phosphor-icons/react';
import { auth } from '@/lib/firebase';
import {
  checkIsAdmin, getAllMembers, getPendingPayments, getAllRewards, getAllReferrals,
  verifyPayment, updateMemberStatus, logoutUser, formatDate,
  getAllWithdrawals, processWithdrawal, releaseReward, getAllTrios,
} from '@/lib/firebase-service';
import type { UserData, Payment, Reward, Referral, Withdrawal, Trio } from '@/lib/types';

type TabId = 'members' | 'payments' | 'rewards' | 'referrals' | 'withdrawals' | 'teams';
type StatusFilter = '' | 'Active' | 'Pending' | 'Lapsed';
type PlanFilter = '' | 'Plus' | 'Gold';

const STATUS_COLORS: Record<string, string> = {
  Active: 'text-[#00a87e] bg-[#00a87e]/10 border-[#00a87e]/20',
  Pending: 'text-[#f3cc20] bg-[#f3cc20]/10 border-[#f3cc20]/20',
  Lapsed: 'text-[#e23b4a] bg-[#e23b4a]/10 border-[#e23b4a]/20',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[status] ?? ''}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-[#191c1f] border border-white/10 rounded-2xl p-5">
      <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className={`font-display font-extrabold text-3xl ${highlight ? 'text-[#f3cc20]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [members, setMembers] = useState<(UserData & { id: string })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [trios, setTrios] = useState<Trio[]>([]);
  const [tab, setTab] = useState<TabId>('members');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('');
  const [drawer, setDrawer] = useState<(UserData & { id: string }) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/admin'); return; }
      const admin = await checkIsAdmin(user.uid);
      if (!admin) { router.push('/admin'); return; }
      setAdminEmail(user.email || '');
      setReady(true);
    });
    return () => unsub();
  }, [router]);

  const loadData = useCallback(async () => {
    const result = await getAllMembers();
    if (result.success && result.members) setMembers(result.members);
  }, []);

  const loadPayments = useCallback(async () => {
    const result = await getPendingPayments();
    if (result.success && result.payments) setPayments(result.payments);
  }, []);

  const loadRewards = useCallback(async () => {
    const data = await getAllRewards();
    setRewards(data);
  }, []);

  const loadReferrals = useCallback(async () => {
    const data = await getAllReferrals();
    setReferrals(data);
  }, []);

  const loadWithdrawals = useCallback(async () => {
    const result = await getAllWithdrawals();
    if (result.success && result.withdrawals) setWithdrawals(result.withdrawals);
  }, []);

  const loadTrios = useCallback(async () => {
    const result = await getAllTrios();
    if (result.success && result.trios) setTrios(result.trios);
  }, []);

  useEffect(() => {
    if (ready) { loadData(); loadPayments(); loadRewards(); loadReferrals(); loadWithdrawals(); loadTrios(); }
  }, [ready, loadData, loadPayments, loadRewards, loadReferrals, loadWithdrawals, loadTrios]);

  async function handleVerifyPayment(paymentId: string) {
    const user = auth.currentUser;
    if (!user) return;
    await verifyPayment(paymentId, user.uid);
    alert('Payment verified successfully.');
    await Promise.all([loadPayments(), loadData()]);
  }

  async function handleSetStatus(id: string, status: 'Active' | 'Pending' | 'Lapsed') {
    await updateMemberStatus(id, status);
    setMembers((prev) =>
      prev.map((m) => m.id === id ? { ...m, status, isActivated: status === 'Active' } : m)
    );
    setDrawer((prev) => prev?.id === id ? { ...prev, status, isActivated: status === 'Active' } : prev);
    await loadData();
  }

  async function handleProcessWithdrawal(id: string, action: 'approved' | 'rejected') {
    const user = auth.currentUser;
    if (!user) return;
    await processWithdrawal(id, action, user.uid);
    await loadWithdrawals();
    await loadData();
  }

  async function handleReleaseReward(rewardId: string) {
    const user = auth.currentUser;
    if (!user) return;
    await releaseReward(rewardId, user.uid);
    await loadRewards();
  }

  async function handleSignOut() {
    await logoutUser();
    router.push('/admin');
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchQ = !q || (m.fullName || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q) || (m.idNumber || '').includes(q);
    const matchS = !statusFilter || m.status === statusFilter;
    const matchP = !planFilter || (m.planType || '').toLowerCase().includes(planFilter.toLowerCase()) || (m.tier || '').toLowerCase().includes(planFilter.toLowerCase());
    return matchQ && matchS && matchP;
  });

  const active = members.filter((m) => m.isActivated).length;
  const pending = members.length - active;

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#111315] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading admin…</div>
      </div>
    );
  }

  return (
    <div className="bg-[#111315] min-h-screen text-white">
      {/* Top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#191c1f] border-b border-white/10 h-14 flex items-center px-5 gap-3">
        <div className="font-display font-extrabold text-white text-lg">
          Go<span className="text-[#f3cc20]">Direct</span>247{' '}
          <span className="text-white/30 font-normal text-sm ml-1">Admin</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-white/50 text-sm hidden sm:block">{adminEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-white/40 hover:text-white transition-colors p-1"
            title="Sign out"
          >
            <SignOut size={18} />
          </button>
        </div>
      </nav>

      <div className="pt-14 max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="ani1 grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total members" value={members.length} sub={`${members.length} this month`} />
          <StatCard
            label="Active policies"
            value={active}
            sub={members.length ? `${Math.round((active / members.length) * 100)}% activation rate` : '-'}
          />
          <StatCard label="Pending review" value={pending} sub="Awaiting activation" highlight />
          <StatCard label="This month" value={members.length} sub="New applications" />
        </div>

        {/* Tabs */}
        <div className="ani2 flex gap-2 mb-4 overflow-x-auto pb-1">
          {([
            { id: 'members', label: 'Members' },
            { id: 'payments', label: `Payments${payments.length ? ` (${payments.length})` : ''}` },
            { id: 'rewards', label: `Rewards${rewards.length ? ` (${rewards.length})` : ''}` },
            { id: 'referrals', label: `Referrals${referrals.length ? ` (${referrals.length})` : ''}` },
            { id: 'withdrawals', label: `Withdrawals${withdrawals.filter(w => w.status === 'pending').length ? ` (${withdrawals.filter(w => w.status === 'pending').length})` : ''}` },
            { id: 'teams', label: `Teams${trios.length ? ` (${trios.length})` : ''}` },
          ] as { id: TabId; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap border transition-all ${
                tab === id
                  ? 'bg-[#f3cc20]/10 border-[#f3cc20]/20 text-[#f3cc20]'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {tab === 'members' && (
          <div className="ani3 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            {/* Search + filters */}
            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlass size={16} className="text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, ID or email…"
                  className="w-full bg-white/10 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-white/30 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm"
              >
                <option value="" className="bg-[#191c1f]">All status</option>
                {['Active', 'Pending', 'Lapsed'].map((s) => (
                  <option key={s} value={s} className="bg-[#191c1f]">{s}</option>
                ))}
              </select>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
                className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm"
              >
                <option value="" className="bg-[#191c1f]">All plans</option>
                <option value="Plus" className="bg-[#191c1f]">Plus Plan</option>
                <option value="Gold" className="bg-[#191c1f]">Gold Plan</option>
              </select>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Member', 'Plan', 'Status', 'Applied', 'Action'].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
                      onClick={() => setDrawer(m)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white text-sm">{m.fullName || 'Unknown'}</div>
                        <div className="text-white/40 text-xs">{m.email || ''}</div>
                      </td>
                      <td className="px-5 py-3.5 text-white/70 text-sm">{m.tier || '-'}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={m.status ?? 'Pending'} />
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(m.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDrawer(m); }}
                          className="text-white/40 hover:text-white text-xs border border-white/15 rounded-full px-3 py-1 hover:border-white/30 transition-all"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-white/5">
              {filtered.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setDrawer(m)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <div>
                    <div className="font-semibold text-white text-sm">{m.fullName || 'Unknown'}</div>
                    <div className="text-white/40 text-xs mt-0.5">
                      {m.tier || '-'} · {formatDate(m.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status ?? 'Pending'} />
                    <span className="text-white/30">›</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10 text-white/30 text-xs">
              Showing {filtered.length} of {members.length} members
            </div>
          </div>
        )}

        {/* Payments tab */}
        {tab === 'payments' && (
          <div className="ani4 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-base">Pending Payments</h3>
              <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-2.5 py-1 rounded-full">
                {payments.length}
              </span>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Member', 'Type', 'Amount', 'Date', 'Action'].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td className="px-5 py-4 text-white/40 text-sm" colSpan={5}>No pending payments</td></tr>
                  ) : payments.map((p) => {
                    const member = members.find((m) => m.id === p.userId);
                    const name = member ? member.fullName : p.userId.slice(0, 8);
                    const typeLabel: Record<string, string> = { self: 'Self Activation', family1: 'Family 1', family2: 'Family 2' };
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-white text-sm">{name}</div>
                          <div className="text-white/40 text-xs">{p.userId}</div>
                        </td>
                        <td className="px-5 py-3.5 text-white/70 text-sm">{typeLabel[p.type] || p.type}</td>
                        <td className="px-5 py-3.5 text-white font-semibold text-sm">R{p.amount || 0}</td>
                        <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(p.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleVerifyPayment(p.id)}
                            className="bg-[#00a87e]/10 border border-[#00a87e]/20 text-[#00a87e] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#00a87e]/20 transition-all"
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rewards tab */}
        {tab === 'rewards' && (
          <div className="ani4 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-base">Pre-Launch Special Rewards</h3>
              <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-2.5 py-1 rounded-full">
                {rewards.length}
              </span>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Member', 'Referrals', 'Reward', 'Status', 'Release Date', ''].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rewards.length === 0 ? (
                    <tr><td className="px-5 py-4 text-white/40 text-sm" colSpan={5}>No rewards yet</td></tr>
                  ) : rewards.map((r) => {
                    const member = members.find((m) => m.id === r.userId);
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-white text-sm">{member?.fullName || r.userId.slice(0, 8)}</div>
                          <div className="text-white/40 text-xs">{r.userId}</div>
                        </td>
                        <td className="px-5 py-3.5 text-white/70 text-sm">{r.referralCount ?? '-'}</td>
                        <td className="px-5 py-3.5 text-[#f3cc20] font-semibold text-sm">R{r.totalAmount}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={r.status === 'released' ? 'Active' : 'Pending'} /></td>
                        <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(r.releaseDate)}</td>
                        <td className="px-5 py-3.5">
                          {r.status !== 'released' && (
                            <button
                              onClick={() => handleReleaseReward(r.id)}
                              className="bg-[#f3cc20]/10 border border-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#f3cc20]/20 transition-all"
                            >
                              Release
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Referrals tab */}
        {tab === 'referrals' && (
          <div className="ani4 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-base">Referral Commissions</h3>
              <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-2.5 py-1 rounded-full">
                {referrals.length}
              </span>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Referrer', 'Referred', 'Commission', 'Status', 'Date'].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.length === 0 ? (
                    <tr><td className="px-5 py-4 text-white/40 text-sm" colSpan={5}>No referrals yet</td></tr>
                  ) : referrals.map((r) => {
                    const referrer = members.find((m) => m.id === r.referrerId);
                    const referred = members.find((m) => m.id === r.referredUserId);
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-white text-sm">{referrer?.fullName || r.referrerId.slice(0, 8)}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-white text-sm">{referred?.fullName || r.referredUserId.slice(0, 8)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-[#f3cc20] font-semibold text-sm">R{r.commissionAmount}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={r.status === 'paid' ? 'Active' : 'Pending'} /></td>
                        <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Withdrawals tab */}
        {tab === 'withdrawals' && (
          <div className="ani4 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-base">Withdrawal Requests</h3>
              <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-2.5 py-1 rounded-full">
                {withdrawals.filter((w) => w.status === 'pending').length} pending
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Member', 'Bank', 'Account', 'Amount', 'Status', 'Date', 'Action'].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.length === 0 ? (
                    <tr><td className="px-5 py-4 text-white/40 text-sm" colSpan={7}>No withdrawal requests yet</td></tr>
                  ) : withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white text-sm">{w.userName}</div>
                        <div className="text-white/40 text-xs">{w.accountHolder}</div>
                      </td>
                      <td className="px-5 py-3.5 text-white/70 text-sm">{w.bankName}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-white/70 text-sm">{w.accountNumber}</div>
                        <div className="text-white/40 text-xs">{w.accountType}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[#f3cc20] font-semibold text-sm">R{w.amount.toLocaleString()}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={w.status === 'approved' ? 'Active' : w.status === 'rejected' ? 'Lapsed' : 'Pending'} />
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(w.requestedAt)}</td>
                      <td className="px-5 py-3.5">
                        {w.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'approved')}
                              className="bg-[#00a87e]/10 border border-[#00a87e]/20 text-[#00a87e] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#00a87e]/20 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'rejected')}
                              className="bg-[#e23b4a]/10 border border-[#e23b4a]/20 text-[#e23b4a] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#e23b4a]/20 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teams tab */}
        {tab === 'teams' && (
          <div className="ani4 bg-[#191c1f] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-white text-base">Generosity Teams (Trios)</h3>
              <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-2.5 py-1 rounded-full">
                {trios.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Leader', 'Members', 'Step', 'Status', 'Created'].map((h) => (
                      <th key={h} className="text-left text-white/30 text-xs uppercase tracking-wide font-semibold px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trios.length === 0 ? (
                    <tr><td className="px-5 py-4 text-white/40 text-sm" colSpan={5}>No teams formed yet</td></tr>
                  ) : trios.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white text-sm">{t.leaderName}</div>
                        <div className="text-white/40 text-xs">{t.leaderId.slice(0, 8)}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-white/70 text-sm">{t.memberNames.join(', ')}</div>
                        <div className="text-white/40 text-xs">{t.memberIds.length} members</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[#f3cc20] font-semibold text-sm">{t.step} / 9</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={t.status === 'active' ? 'Active' : t.status === 'complete' ? 'Active' : 'Pending'} />
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Member drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawer(null)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#191c1f] border-l border-white/10 overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#191c1f] z-10">
              <h2 className="font-display font-bold text-white text-lg">{drawer.fullName || 'Member'}</h2>
              <button onClick={() => setDrawer(null)} className="text-white/40 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Details */}
              <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-4 space-y-3">
                {[
                  ['Status', <StatusBadge key="s" status={drawer.status ?? 'Pending'} />],
                  ['Plan', <span key="p" className="text-white">{drawer.tier || '-'}</span>],
                  ['ID Number', <span key="id" className="text-white/70">{drawer.idNumber || '-'}</span>],
                  ['Email', <span key="e" className="text-white/70">{drawer.email || '-'}</span>],
                  ['Phone', <span key="ph" className="text-white/70">{drawer.phone || '-'}</span>],
                  ['Applied', <span key="a" className="text-white/70">{formatDate(drawer.createdAt)}</span>],
                  ['Dependents', <span key="d" className="text-white/70">{(drawer.dependents || []).length}</span>],
                  ['Referral', <span key="r" className="text-white/70">{drawer.referredByName || (drawer.referredBy ? 'Yes' : 'None')}</span>],
                  ['Generosity Step', <span key="gs" className="text-white">{drawer.generosityStep || 0} / 9</span>],
                  ['Harvest Balance', <span key="hb" className="text-[#f3cc20] font-semibold">R{drawer.harvestBalance || 0}</span>],
                  ['Earnings', <span key="earn" className="text-[#f3cc20] font-semibold">R{drawer.totalEarnings || 0}</span>],
                  ['Link Shares', <span key="shares" className="text-white/70">{drawer.shareCount || 0}</span>],
                  ['Share Earnings', <span key="shareEarn" className="text-[#f3cc20] font-semibold">R{drawer.shareEarnings || 0}</span>],
                  ['Team ID', <span key="tid" className="text-white/70">{drawer.trioId ? drawer.trioId.slice(0, 12) + '…' : 'None'}</span>],
                  ['Funded By', <span key="fb" className="text-white/70">{drawer.fundedBy ? drawer.fundedBy.slice(0, 12) + '…' : 'Self-funded'}</span>],
                  ['Downstream Rewards', <span key="dr" className="text-[#00a87e] font-semibold">R{drawer.downstreamRewards || 0}</span>],
                ].map(([k, v]) => (

                  <div key={k as string} className="flex items-center justify-between gap-4">
                    <span className="text-white/40 text-xs uppercase tracking-wide font-semibold">{k}</span>
                    {v}
                  </div>
                ))}
              </div>

              {/* Status actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleSetStatus(drawer.id, 'Active')}
                  className="bg-[#00a87e]/10 border border-[#00a87e]/20 text-[#00a87e] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#00a87e]/20 transition-all"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleSetStatus(drawer.id, 'Pending')}
                  className="bg-[#f3cc20]/10 border border-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#f3cc20]/20 transition-all"
                >
                  Pending
                </button>
                <button
                  onClick={() => handleSetStatus(drawer.id, 'Lapsed')}
                  className="bg-[#e23b4a]/10 border border-[#e23b4a]/20 text-[#e23b4a] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#e23b4a]/20 transition-all"
                >
                  Lapse
                </button>
              </div>

              {/* Earnings trend */}
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                <TrendUp size={20} className="text-[#00a87e]" />
                <div>
                  <p className="text-white text-sm font-semibold">Total earnings</p>
                  <p className="text-[#f3cc20] font-display font-bold">R{drawer.totalEarnings || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
