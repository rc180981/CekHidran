'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition inline-flex items-center"
      title="Keluar Akun"
    >
      <LogOut size={20} />
    </button>
  );
}
