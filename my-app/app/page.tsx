import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Certificate,
  Clock,
  Coins,
  Lightning,
  ShareNetwork,
  Heartbeat,
  Phone,
  Gift,
} from '@phosphor-icons/react/dist/ssr';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PlansTabs } from '@/components/PlansTabs';
import { RefTracker } from '@/components/RefTracker';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const ref = typeof params.ref === 'string' ? params.ref : undefined;

  return (
    <>
      <Navbar />
      <RefTracker code={ref} />

      {/* ── Hero ── */}
      <section className="bg-[#191c1f] pt-16 min-h-screen flex flex-col justify-center">
        <div className="max-w-6xl mx-auto px-5 py-24 md:py-32">
          <div className="max-w-3xl">
            {ref && (
              <div className="ani1 inline-flex items-center gap-2 bg-[#f3cc20]/10 border border-[#f3cc20]/30 rounded-full px-4 py-1.5 mb-6">
                <Gift className="text-[#f3cc20]" size={14} />
                <span className="text-[#f3cc20]/90 text-xs font-medium">
                  You were invited — sign up to claim your funeral cover
                </span>
              </div>
            )}
            <div className="ani1 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-8">
              <ShieldCheck className="text-[#f3cc20]" size={14} />
              <span className="text-white/70 text-xs font-medium tracking-wide">
                FSP Licence JR 50841 &middot; Zarkudu Group
              </span>
            </div>
            <h1 className="ani2 font-display text-white text-5xl sm:text-6xl md:text-[78px] font-extrabold leading-none tracking-tight mb-6">
              Protect your<br />
              family. <span className="text-[#f3cc20]">Earn</span>
              <br />
              while you cover.
            </h1>
            <p className="ani3 text-white/50 text-lg md:text-xl leading-relaxed max-w-lg mb-10">
              Affordable funeral cover with real cashback rewards. Two plans, six tiers &mdash; peace
              of mind for your whole family.
            </p>
            <div className="ani4 flex flex-col sm:flex-row gap-3">
              <Link
                href="/signup"
                className="bg-[#f3cc20] text-[#191c1f] font-display font-bold text-base px-8 py-4 rounded-full text-center hover:bg-[#c9a800] transition-all"
              >
                Choose your plan
              </Link>
              <Link
                href="#how-it-works"
                className="border-2 border-white/25 text-white font-medium text-base px-8 py-4 rounded-full text-center hover:border-white/50 hover:bg-white/5 transition-all"
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="ani5 mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="bg-white/[0.06] border border-white/15 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-bold text-white">Plus Plan</span>
                <span className="bg-sky-900/40 text-sky-300 text-xs font-semibold px-3 py-1 rounded-full border border-sky-700/30">
                  6 Tiers
                </span>
              </div>
              <p className="text-white/40 text-xs mb-4">
                Funeral cover &middot; cashback from month 4 &middot; refer &amp; earn
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Silver', 'Gold', 'Diamond', 'Premier', 'Prestige', 'King'].map((t) => (
                  <span key={t} className="bg-white/10 text-white/60 text-xs px-2.5 py-1 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-[#f3cc20]/[0.06] border border-[#f3cc20]/25 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-bold text-white">Gold Plan</span>
                <span className="bg-[#f3cc20]/20 text-[#f3cc20] text-xs font-semibold px-3 py-1 rounded-full border border-[#f3cc20]/30">
                  7 Tiers
                </span>
              </div>
              <p className="text-white/40 text-xs mb-4">
                Payout after 6 weeks &middot; cashback every 3 months &middot; refer &amp; earn
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Silver', 'Gold', 'Diamond', 'Premier', 'Prestige', 'King'].map((t) => (
                  <span key={t} className="bg-[#f3cc20]/10 text-[#f3cc20]/70 text-xs px-2.5 py-1 rounded-full">
                    {t}
                  </span>
                ))}
                <span className="bg-[#f3cc20]/20 text-[#f3cc20] font-semibold text-xs px-2.5 py-1 rounded-full">
                  Superior
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pre-launch banner ── */}
      <section className="bg-[#191c1f] border-y border-[#f3cc20]/20">
        <div className="max-w-4xl mx-auto px-5 py-10">
          <div className="bg-[#f3cc20]/[0.06] border border-[#f3cc20]/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#f3cc20]/5 rounded-full -mr-10 -mt-10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#f3cc20] text-[#191c1f] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  Limited Offer
                </span>
                <span className="text-[#f3cc20]/70 text-xs font-semibold">Ends 30 May 2026</span>
              </div>
              <h2 className="font-display font-bold text-[#f3cc20] text-2xl md:text-3xl mb-3 tracking-tight">
                Pre Launch SPECIAL
              </h2>
              <p className="text-white/70 text-sm md:text-base leading-relaxed mb-5">
                <strong className="text-[#f3cc20]">Generosity Reward:</strong> Join, Activate = R650,
                Gift 2 Families, Activate with R650 x 2 = R1,300 For Them. Be Rewarded With A Cashback
                Of All Your 3 Activation Fees = R1,950. Plus A Thank Reward Worth R1,050 More.{' '}
                <strong className="text-[#f3cc20]">Total Reward: R3,000</strong> (paid after 6 weeks)
                including a{' '}
                <strong className="text-white">
                  R10,000 Free Funeral Cover FOR the Whole Year (12 Months)
                </strong>{' '}
                for All 3 Families.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <Coins size={14} className="text-[#f3cc20]" /> Free R10,000 Cover For Year
                </span>
                <span className="flex items-center gap-1.5">
                  <Coins size={14} className="text-[#f3cc20]" /> Join Free. Earn For Helping Us Grow
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-[#f4f4f4] border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-5 py-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: <Users size={24} className="text-[#0682B4]" />, stat: '1 000+', label: 'Families covered' },
              { icon: <Certificate size={24} className="text-[#0682B4]" />, stat: 'FSP Lic.', label: 'JR 50841' },
              { icon: <Clock size={24} className="text-[#0682B4]" />, stat: '24–48 hrs', label: 'Claim payout' },
              { icon: <Coins size={24} className="text-[#0682B4]" />, stat: 'Cashback', label: 'Real rewards' },
            ].map(({ icon, stat, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                {icon}
                <span className="font-display font-bold text-[#191c1f] text-lg">{stat}</span>
                <span className="text-[#8d969e] text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#0682B4] text-sm font-semibold tracking-widest uppercase">
              Simple process
            </span>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-[#191c1f] mt-3 tracking-tight">
              Up and covered in minutes
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                num: '01',
                title: 'Choose your plan',
                body: "Pick Plus or Gold, then the tier that fits your budget. See exactly what's covered before committing.",
                bg: 'bg-[#f4f4f4]',
                bodyColor: 'text-[#505a63]',
              },
              {
                num: '02',
                title: 'Cover your family',
                body: 'Add your spouse, up to 4 dependents, and extended family in a few taps. No medicals required.',
                bg: 'bg-[#f4f4f4]',
                bodyColor: 'text-[#505a63]',
              },
              {
                num: '03',
                title: 'Activate & earn',
                body: 'Pay your activation fee and cover starts. Cashback arrives on the 5th of your 4th month.',
                bg: 'bg-[#f3cc20]',
                bodyColor: 'text-[#191c1f]/70',
              },
            ].map(({ num, title, body, bg, bodyColor }) => (
              <div key={num} className={`${bg} rounded-2xl p-8 relative overflow-hidden`}>
                <div className="w-10 h-10 bg-[#191c1f] rounded-xl flex items-center justify-center mb-6">
                  <span className="font-display font-bold text-white text-sm">{num}</span>
                </div>
                <h3 className="font-display font-bold text-xl text-[#191c1f] mb-3">{title}</h3>
                <p className={`${bodyColor} text-sm leading-relaxed`}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section id="plans" className="bg-[#191c1f] py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#f3cc20] text-sm font-semibold tracking-widest uppercase">
              Two plans
            </span>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mt-3 tracking-tight">
              Find the right cover
            </h2>
            <p className="text-white/50 text-base mt-4 max-w-lg mx-auto">
              One activation fee. Funeral cover from day one. Cashback from month 4.
            </p>
          </div>
          <PlansTabs />
        </div>
      </section>

      {/* ── Benefits ── */}
      <section id="benefits" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#0682B4] text-sm font-semibold tracking-widest uppercase">
              Why GoDirect247
            </span>
            <h2 className="font-display font-extrabold text-4xl md:text-5xl text-[#191c1f] mt-3 tracking-tight">
              Everything you need
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <Lightning size={24} className="text-[#00a87e]" />,
                iconBg: 'bg-[#00a87e]/10',
                title: 'Fast claims',
                body: 'Processed and paid within 24–48 hours of receiving required documentation.',
              },
              {
                icon: <Coins size={24} className="text-yellow-600" />,
                iconBg: 'bg-[#f3cc20]/20',
                title: 'Cashback rewards',
                body: 'Real money back from month 4. Gold members also earn quarterly payouts.',
              },
              {
                icon: <ShareNetwork size={24} className="text-[#0682B4]" />,
                iconBg: 'bg-[#0682B4]/10',
                title: 'Refer & earn',
                body: 'Earn commission for every referral. Not mandatory — your choice entirely.',
              },
              {
                icon: <Users size={24} className="text-purple-500" />,
                iconBg: 'bg-purple-50',
                title: 'Full family cover',
                body: 'Spouse, up to 4 dependents, and extended family all under one policy.',
              },
              {
                icon: <Heartbeat size={24} className="text-[#00a87e]" />,
                iconBg: 'bg-[#00a87e]/10',
                title: 'No medicals',
                body: 'No health exams or questions. Apply in minutes from your phone.',
              },
              {
                icon: <Certificate size={24} className="text-[#191c1f]" />,
                iconBg: 'bg-gray-100',
                title: 'FSP Licensed',
                body: 'Fully regulated. GoDirect247 is a division of Zarkudu Group, FSP Licence JR 50841.',
              },
            ].map(({ icon, iconBg, title, body }) => (
              <div
                key={title}
                className="p-7 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all"
              >
                <div
                  className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mb-5`}
                >
                  {icon}
                </div>
                <h3 className="font-display font-bold text-[#191c1f] text-lg mb-2">{title}</h3>
                <p className="text-[#505a63] text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-[#191c1f] py-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white tracking-tight mb-5 leading-tight">
            Ready to protect your family today?
          </h2>
          <p className="text-white/50 text-lg mb-10">
            Takes less than 5 minutes. No medicals. Pick the tier that fits your budget.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-[#f3cc20] text-[#191c1f] font-display font-bold text-base px-10 py-4 rounded-full hover:bg-[#c9a800] transition-all"
            >
              Get started now
            </Link>
            <a
              href="tel:+27780187995"
              className="border-2 border-white/25 text-white font-medium text-base px-10 py-4 rounded-full hover:border-white/50 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Phone size={16} /> +27 78 018 7995
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
