'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Flame,
  AlertTriangle,
  Users,
  Settings,
  FileDown,
  LogOut,
  History,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { can, ROLE_LABEL, type Role } from '@/lib/rbac';

interface SidebarProps {
  user: {
    name: string;
    role: Role;
  };
}

export default function AdminSidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: '/dashboard',
      label: 'DASHBOARD PEMANTAUAN',
      icon: LayoutDashboard,
      allowed: can(user.role, 'lihat_dashboard'),
    },
    {
      href: '/dashboard/riwayat',
      label: 'RIWAYAT CHECKSHEET',
      icon: History,
      allowed: can(user.role, 'lihat_riwayat_semua'),
    },
    {
      href: '/dashboard/temuan',
      label: 'TEMUAN K3',
      icon: AlertTriangle,
      allowed: can(user.role, 'verifikasi_temuan') || can(user.role, 'lihat_riwayat_semua'),
    },
    {
      href: '/dashboard/hydrant',
      label: 'TITIK & EQUIPMENT',
      icon: Flame,
      allowed: can(user.role, 'kelola_hydrant'),
    },
    {
      href: '/dashboard/pengguna',
      label: 'KELOLA PENGGUNA',
      icon: Users,
      allowed: can(user.role, 'kelola_pengguna'),
    },
    {
      href: '/dashboard/laporan',
      label: 'EKSPOR LAPORAN',
      icon: FileDown,
      allowed: can(user.role, 'ekspor_laporan'),
    },
    {
      href: '/dashboard/pengaturan',
      label: 'PENGATURAN',
      icon: Settings,
      allowed: can(user.role, 'kelola_pengaturan'),
    },
  ];

  return (
    <aside className="w-64 bg-sidebar text-slate-200 flex flex-col min-h-screen shrink-0">
      {/* Brand */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-700/60">
        <Logo size={36} />
        <div>
          <span className="font-extrabold text-base text-white tracking-wider block uppercase">CEK HIDRAN</span>
          <span className="text-[10px] text-teal-400 font-semibold tracking-wider block uppercase">SISTEM PEMANTAUAN K3</span>
        </div>
      </div>

      {/* Profil User */}
      <div className="px-5 py-4 border-b border-slate-700/40 bg-slate-800/40">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider">PENGGUNA AKTIF</p>
        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
        <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 bg-primary/20 text-teal-300 rounded-md border border-primary/30 uppercase">
          {ROLE_LABEL[user.role]}
        </span>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links
          .filter((item) => item.allowed)
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wider transition ${
                  active
                    ? 'bg-primary text-white font-bold shadow-sm'
                    : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700/60">
        <button
          type="button"
          onClick={async () => {
            const { auth } = await import('@/lib/firebase/client');
            const { signOut } = await import('firebase/auth');
            await signOut(auth);
            window.location.href = '/login';
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-red-300 hover:bg-red-500/10 hover:text-red-200 transition"
        >
          <LogOut size={18} className="text-red-400" />
          KELUAR SISTEM
        </button>
      </div>
    </aside>
  );
}
