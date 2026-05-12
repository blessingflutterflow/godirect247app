import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#191c1f] border-t border-white/10 py-12 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="font-display font-extrabold text-white text-xl mb-3">
              Go<span className="text-[#f3cc20]">Direct</span>247
            </div>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              A division of Zarkudu Group. FSP Licence JR 50841.
            </p>
          </div>

          <div>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-4">
              Navigation
            </p>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: '/', label: 'Home' },
                { href: '/signup', label: 'Get Started' },
                { href: '/dashboard', label: 'Member Login' },
                { href: '/admin', label: 'Admin' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-white/50 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/30">
          <span>&copy; 2026 GoDirect247 &middot; Zarkudu Group &middot; FSP Licence JR 50841</span>
          <span>Platform v2.0</span>
        </div>
      </div>
    </footer>
  );
}
