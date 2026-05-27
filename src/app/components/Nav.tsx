import Link from 'next/link';

export function Nav({ active }: { active: 'dashboard' | 'trades' | 'agent-logs' }) {
  const links = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/trades', label: 'Trade History', key: 'trades' },
    { href: '/agent-logs', label: 'Agent Logs', key: 'agent-logs' },
  ] as const;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-blue-400 font-bold text-base">📈 WSB Trader</span>
        {links.map(link => (
          <Link
            key={link.key}
            href={link.href}
            className={`text-sm ${active === link.key ? 'text-blue-400 border-b-2 border-blue-400 pb-0.5' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="text-gray-600 text-xs">Sim only — no real trades</span>
    </nav>
  );
}
