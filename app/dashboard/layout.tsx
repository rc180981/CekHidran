import { requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Jika petugas masuk ke URL dashboard, arahkan ke antarmuka petugas
  if (user.role === 'petugas') {
    redirect('/petugas');
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <AdminSidebar user={{ name: user.name, role: user.role }} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
