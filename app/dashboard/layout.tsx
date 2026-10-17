'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ROLE_LABEL } from '@/lib/rbac';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || !profile) {
        router.push('/login');
      } else if (profile.role === 'petugas') {
        router.push('/petugas');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || !profile || profile.role === 'petugas') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memeriksa hak akses…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row">
      {/* Responsive Admin Sidebar (Drawer on mobile, permanent column on desktop) */}
      <AdminSidebar
        user={{ name: profile.name, role: profile.role }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Navigation Bar (Visible only on < lg) */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 py-2.5 backdrop-blur-md pt-safe">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka Menu Navigasi"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Logo size={28} />
              <div className="truncate">
                <span className="text-xs font-black tracking-wider text-slate-900 uppercase block truncate">
                  CEK HIDRAN
                </span>
                <span className="text-[9px] font-bold text-primary tracking-wider uppercase block">
                  {ROLE_LABEL[profile.role]}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 pl-2">
            <span className="inline-block text-[11px] font-semibold text-slate-600 max-w-[120px] truncate bg-slate-100 px-2.5 py-1 rounded-lg">
              {profile.name}
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
