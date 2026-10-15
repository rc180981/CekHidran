'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, firebaseConfig } from '@/lib/firebase/client';
import { ROLE_LABEL, Role } from '@/lib/rbac';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  UserCheck,
  Shield,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Users,
  User,
  Power,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Wrench,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function KelolaPenggunaPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'petugas' as Role,
    warehouseIds: ['wh2'],
    active: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // State Manajemen Kata Sandi Langsung (Direct Reset)
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchData = async () => {
    try {
      const [pSnap, wSnap] = await Promise.all([
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'warehouses')),
      ]);

      const pList: any[] = [];
      pSnap.forEach((d) => pList.push({ id: d.id, ...d.data() }));
      pList.sort((a, b) => a.name.localeCompare(b.name));
      setProfiles(pList);

      const wList: any[] = [];
      wSnap.forEach((d) => wList.push(d.data()));
      wList.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(wList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !!p.active) ||
        (statusFilter === 'inactive' && !p.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, searchQuery, roleFilter, statusFilter]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = profiles.length;
    const petugasCount = profiles.filter((p) => p.role === 'petugas').length;
    const supervisorAdminCount = profiles.filter(
      (p) => p.role === 'admin_sistem' || p.role === 'supervisor_k3'
    ).length;
    const activeCount = profiles.filter((p) => p.active).length;

    return { total, petugasCount, supervisorAdminCount, activeCount };
  }, [profiles]);

  const handleToggleActive = async (id: string, current: boolean, userEmail?: string) => {
    if (
      auth.currentUser &&
      (auth.currentUser.uid === id ||
        (userEmail && auth.currentUser.email?.toLowerCase() === userEmail.toLowerCase()))
    ) {
      alert('Anda tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif digunakan.');
      return;
    }

    try {
      await updateDoc(doc(db, 'profiles', id), { active: !current });
      setActionNotice(
        `Status akun berhasil diubah menjadi ${!current ? 'Aktif' : 'Nonaktif'}.`
      );
      setTimeout(() => setActionNotice(null), 3500);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Gagal mengubah status pengguna.');
    }
  };

  const generateRandomPassword = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generated = `Hidran#${randomPart}!`;
    if (editingUser) {
      setResetPasswordInput(generated);
      setShowResetPassword(true);
    } else {
      setUserForm((prev) => ({ ...prev, password: generated }));
      setShowPassword(true);
    }
  };

  const handleCopyPassword = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'petugas',
      warehouseIds: ['wh2'],
      active: true,
    });
    setResetPasswordInput('');
    setResetSuccessNotice(null);
    setShowPassword(false);
    setFormError(null);
    setUserModalOpen(true);
  };

  const handleOpenEditModal = (p: any) => {
    setEditingUser(p);
    setUserForm({
      name: p.name,
      email: p.email,
      password: '',
      role: p.role,
      warehouseIds: p.warehouseIds || ['wh2'],
      active: !!p.active,
    });
    setResetPasswordInput('');
    setResetSuccessNotice(null);
    setShowPassword(false);
    setShowResetPassword(false);
    setFormError(null);
    setUserModalOpen(true);
  };

  const handleDirectResetPassword = async () => {
    if (!editingUser) return;
    if (!resetPasswordInput || resetPasswordInput.trim().length < 6) {
      setFormError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    setResetLoading(true);
    setFormError(null);
    setResetSuccessNotice(null);

    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUid: auth.currentUser?.uid,
          targetUid: editingUser.id,
          newPassword: resetPasswordInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mereset kata sandi.');
      }

      setResetSuccessNotice(`Kata sandi akun "${editingUser.name}" berhasil direset langsung ke: ${resetPasswordInput.trim()}`);
      setActionNotice(`Kata sandi akun "${editingUser.name}" berhasil direset.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Gagal mereset kata sandi pengguna.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingUser) {
        // Mode 1: Edit Data Pengguna
        // Jika admin juga mengisi kata sandi baru di form edit
        if (resetPasswordInput && resetPasswordInput.trim().length > 0) {
          if (resetPasswordInput.trim().length < 6) {
            setFormError('Kata sandi baru minimal harus 6 karakter.');
            setSubmitting(false);
            return;
          }

          const res = await fetch('/api/admin/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminUid: auth.currentUser?.uid,
              targetUid: editingUser.id,
              newPassword: resetPasswordInput.trim(),
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Gagal memperbarui kata sandi akun.');
          }
        }

        await updateDoc(doc(db, 'profiles', editingUser.id), {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          warehouseIds: userForm.role === 'petugas' ? userForm.warehouseIds : ['wh2', 'wh3', 'wh4'],
          active: userForm.active,
          updated_at: new Date().toISOString(),
        });

        setActionNotice(`Data profil pengguna "${userForm.name}" berhasil diperbarui.`);
        setTimeout(() => setActionNotice(null), 4000);
      } else {
        // Mode 2: Tambah Pengguna Baru
        if (!userForm.password || userForm.password.length < 6) {
          setFormError('Kata sandi awal wajib diisi minimal 6 karakter.');
          setSubmitting(false);
          return;
        }

        // Secondary Auth App agar sesi login admin tidak logout
        let secondaryApp = getApps().find((a) => a.name === 'SecondaryAuth');
        if (!secondaryApp) {
          secondaryApp = initializeApp(firebaseConfig, 'SecondaryAuth');
        }
        const secondaryAuth = getAuth(secondaryApp);

        // Buat Akun Auth
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          userForm.email.trim(),
          userForm.password
        );

        await signOut(secondaryAuth);

        const newUid = cred.user.uid;

        // Simpan Profil ke Firestore
        await setDoc(doc(db, 'profiles', newUid), {
          id: newUid,
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          warehouseIds: userForm.role === 'petugas' ? userForm.warehouseIds : ['wh2', 'wh3', 'wh4'],
          active: true,
          created_at: new Date().toISOString(),
        });

        setActionNotice(`Pengguna baru "${userForm.name}" berhasil didaftarkan dan siap login.`);
        setTimeout(() => setActionNotice(null), 4000);
      }

      setUserModalOpen(false);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('Alamat email ini sudah terdaftar di sistem. Gunakan email lain.');
      } else if (err.code === 'auth/weak-password') {
        setFormError('Kata sandi terlalu lemah. Masukkan minimal 6 karakter kombinasi.');
      } else if (err.code === 'auth/invalid-email') {
        setFormError('Format alamat email tidak valid.');
      } else {
        setFormError(err?.message || 'Gagal menyimpan data pengguna.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (p: any) => {
    // 1. Larang menghapus akun sendiri yang sedang aktif digunakan
    if (
      auth.currentUser &&
      (auth.currentUser.uid === p.id ||
        (p.email && auth.currentUser.email?.toLowerCase() === p.email.toLowerCase()))
    ) {
      alert(
        'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.\n\nJika ingin menghapus akun ini, silakan masuk menggunakan akun Admin Sistem lain.'
      );
      return;
    }

    if (confirm(`Yakin ingin menghapus pengguna "${p.name}" (${p.email}) secara permanen?`)) {
      try {
        let deletedSuccessfully = false;

        // Coba hapus via API server terlebih dahulu (menghapus dokumen Firestore & Firebase Auth)
        try {
          const res = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminUid: auth.currentUser?.uid,
              targetUid: p.id,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            deletedSuccessfully = true;
          } else if (data.error && !data.fallbackToClient) {
            throw new Error(data.error);
          }
        } catch (apiErr: any) {
          console.warn('API delete-user gagal/fallback:', apiErr?.message);
        }

        // Fallback: Hapus dokumen Firestore langsung dari client SDK jika API belum selesai
        if (!deletedSuccessfully) {
          await deleteDoc(doc(db, 'profiles', p.id));
        }

        setActionNotice(`Pengguna "${p.name}" (${p.email}) berhasil dihapus.`);
        setTimeout(() => setActionNotice(null), 4000);
        fetchData();
      } catch (err: any) {
        console.error('Error saat menghapus pengguna:', err);
        const errMsg =
          err?.code === 'permission-denied'
            ? 'Izin ditolak: Hanya Admin Sistem aktif yang berhak menghapus pengguna.'
            : err?.message || 'Gagal menghapus pengguna.';
        alert(errMsg);
      }
    }
  };

  const handleWarehouseCheckbox = (whId: string) => {
    setUserForm((prev) => {
      const exists = prev.warehouseIds.includes(whId);
      if (exists) {
        return { ...prev, warehouseIds: prev.warehouseIds.filter((id) => id !== whId) };
      } else {
        return { ...prev, warehouseIds: [...prev.warehouseIds, whId] };
      }
    });
  };

  // Helper Warna Avatar dan Badge Role
  const getRoleVisual = (role: Role) => {
    switch (role) {
      case 'admin_sistem':
        return {
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/90',
          avatarGrad: 'from-indigo-600 to-violet-700 text-white',
          label: 'Admin Sistem',
          icon: <ShieldCheck size={12} className="shrink-0 text-indigo-600" />,
        };
      case 'supervisor_k3':
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200/90',
          avatarGrad: 'from-blue-600 to-cyan-700 text-white',
          label: 'Supervisor K3',
          icon: <Shield size={12} className="shrink-0 text-blue-600" />,
        };
      case 'petugas':
        return {
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
          avatarGrad: 'from-emerald-600 to-teal-700 text-white',
          label: 'Petugas Lapangan',
          icon: <Wrench size={12} className="shrink-0 text-emerald-700" />,
        };
      case 'manajemen':
        return {
          badge: 'bg-amber-50 text-amber-800 border-amber-200/90',
          avatarGrad: 'from-amber-600 to-orange-700 text-white',
          label: 'Manajemen',
          icon: <Briefcase size={12} className="shrink-0 text-amber-700" />,
        };
      default:
        return {
          badge: 'bg-slate-50 text-slate-700 border-slate-200',
          avatarGrad: 'from-slate-600 to-slate-800 text-white',
          label: role,
          icon: <User size={12} className="shrink-0 text-slate-600" />,
        };
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat data pengguna…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-primary border border-teal-100 shadow-2xs">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wider text-slate-900 uppercase">
                KELOLA PENGGUNA
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Manajemen hak akses, akun kredensial login, dan penugasan area gudang
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="btn-primary text-xs flex items-center justify-center gap-2 min-h-[44px] px-4.5 rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all self-stretch sm:self-auto"
        >
          <Plus size={16} /> Tambah Pengguna Baru
        </button>
      </div>

      {/* 2. Banner Notifikasi Tindakan */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in shadow-2xs">
          <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 3. Kartu Metrik Statistik Pengguna */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pengguna */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Pengguna
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight">{stats.total}</span>
          </div>
        </div>

        {/* Petugas Lapangan */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Wrench size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Petugas Lapangan
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight">
              {stats.petugasCount}
            </span>
          </div>
        </div>

        {/* Supervisor & Admin */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="h-11 w-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Admin &amp; Supervisor
            </span>
            <span className="text-xl font-black text-slate-900 leading-tight">
              {stats.supervisorAdminCount}
            </span>
          </div>
        </div>

        {/* Akun Aktif */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-colors">
          <div className="h-11 w-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Akun Aktif
            </span>
            <span className="text-xl font-black text-teal-700 leading-tight">
              {stats.activeCount} <span className="text-xs font-semibold text-slate-400">/ {stats.total}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bilah Pencarian & Filter Modern */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Input Cari */}
          <div className="sm:col-span-6 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pengguna atau alamat email…"
              className="input pl-10 h-10.5 w-full text-xs font-medium rounded-xl border-slate-200 bg-slate-50/60 focus:bg-white transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Role */}
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input h-10.5 w-full text-xs font-semibold rounded-xl border-slate-200 bg-slate-50/60 shadow-2xs"
            >
              <option value="all">Semua Peran (Role)</option>
              <option value="petugas">Petugas Lapangan</option>
              <option value="supervisor_k3">Supervisor K3</option>
              <option value="admin_sistem">Admin Sistem</option>
              <option value="manajemen">Manajemen</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-10.5 w-full text-xs font-semibold rounded-xl border-slate-200 bg-slate-50/60 shadow-2xs"
            >
              <option value="all">Semua Status</option>
              <option value="active">Status: Aktif</option>
              <option value="inactive">Status: Nonaktif</option>
            </select>
          </div>
        </div>

        {/* Ringkasan Filter & Reset */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
          <span>
            Menampilkan <strong className="text-slate-900 font-bold">{filteredProfiles.length}</strong> dari{' '}
            <strong className="text-slate-900 font-bold">{profiles.length}</strong> pengguna
          </span>
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="text-primary hover:underline font-bold flex items-center gap-1"
            >
              <RotateCcw size={11} /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* 5. TAMPILAN MOBILE: KARTU PENGGUNA MODERN (MD:HIDDEN) */}
      <div className="block md:hidden space-y-3">
        {filteredProfiles.map((p) => {
          const roleVisual = getRoleVisual(p.role as Role);
          const assignedWh = (p.warehouseIds || [])
            .map((id: string) => warehouses.find((w) => w.id === id)?.name || id)
            .join(', ');
          const isSelf =
            auth.currentUser?.uid === p.id ||
            (p.email && auth.currentUser?.email?.toLowerCase() === p.email.toLowerCase());

          return (
            <div
              key={p.id}
              className={`p-4 rounded-2xl bg-white border shadow-2xs space-y-3.5 transition-all ${
                isSelf ? 'border-primary/40 ring-1 ring-primary/20' : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Header Kartu: Avatar + Nama + Email + Status */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl bg-gradient-to-br ${roleVisual.avatarGrad} shadow-xs flex items-center justify-center font-black text-sm shrink-0`}
                  >
                    {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-sm font-extrabold text-slate-900 leading-tight">
                        {p.name}
                      </strong>
                      {isSelf && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          Anda
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-500 break-all">{p.email}</span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                    p.active
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span>{p.active ? 'Aktif' : 'Nonaktif'}</span>
                </span>
              </div>

              {/* Rincian Role & Penugasan */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Role Sistem:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${roleVisual.badge}`}
                  >
                    {roleVisual.icon}
                    <span>{roleVisual.label}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Penugasan Gudang:
                  </span>
                  <div className="font-semibold text-slate-800 text-xs truncate">
                    {p.role === 'petugas' ? (
                      assignedWh ? (
                        <span className="text-teal-800 font-bold">Gudang {assignedWh}</span>
                      ) : (
                        <span className="text-red-500 font-bold">Belum ditugaskan</span>
                      )
                    ) : (
                      <span className="text-slate-500 font-medium">Semua Gudang</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Baris Tombol Aksi */}
              <div className="pt-1 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSelf}
                  onClick={() => handleToggleActive(p.id, !!p.active, p.email)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shadow-2xs ${
                    isSelf
                      ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100 border-slate-200'
                      : p.active
                      ? 'text-amber-800 bg-amber-50/80 border-amber-200 hover:bg-amber-100'
                      : 'text-emerald-800 bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title={isSelf ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                >
                  <Power size={13} />
                  <span>{p.active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(p)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-all"
                >
                  <Edit2 size={13} className="text-blue-600" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  disabled={isSelf}
                  onClick={() => handleDeleteUser(p)}
                  className={`text-xs font-bold p-2 rounded-xl border shadow-2xs flex items-center transition-all ${
                    isSelf
                      ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                      : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                  title={isSelf ? 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif' : 'Hapus Pengguna'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredProfiles.length === 0 && (
          <div className="p-8 text-center text-slate-500 space-y-2 bg-white rounded-2xl border border-slate-200">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="text-xs font-semibold">Tidak ada pengguna yang cocok dengan kriteria pencarian.</p>
          </div>
        )}
      </div>

      {/* 6. TAMPILAN DESKTOP & TABLET: TABEL RESIK & ELEGAN (HIDDEN PADA MD:BLOCK) */}
      <div className="hidden md:block">
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Header Card */}
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-primary" />
              DAFTAR PENGGUNA SISTEM
            </span>
            <span className="text-xs font-bold text-slate-400">
              {filteredProfiles.length} Pengguna Terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Pengguna &amp; Email</th>
                  <th className="py-3.5 px-4">Role Sistem</th>
                  <th className="py-3.5 px-4">Penugasan Area Gudang</th>
                  <th className="py-3.5 px-4">Status Akun</th>
                  <th className="py-3.5 px-6 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProfiles.map((p) => {
                  const roleVisual = getRoleVisual(p.role as Role);
                  const assignedWh = (p.warehouseIds || [])
                    .map((id: string) => warehouses.find((w) => w.id === id)?.name || id)
                    .join(', ');
                  const isSelf =
                    auth.currentUser?.uid === p.id ||
                    (p.email && auth.currentUser?.email?.toLowerCase() === p.email.toLowerCase());

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition-colors group ${
                        isSelf ? 'bg-primary/5/30' : ''
                      }`}
                    >
                      {/* Kolom 1: Avatar + Nama + Email Terpadu */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl bg-gradient-to-br ${roleVisual.avatarGrad} shadow-xs flex items-center justify-center font-bold text-xs shrink-0`}
                          >
                            {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <strong className="font-bold text-slate-900 text-xs leading-snug">
                                {p.name}
                              </strong>
                              {isSelf && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 block">
                              {p.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 2: Role Sistem dengan Icon */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wide ${roleVisual.badge}`}
                        >
                          {roleVisual.icon}
                          <span>{roleVisual.label}</span>
                        </span>
                      </td>

                      {/* Kolom 3: Penugasan Gudang */}
                      <td className="py-3.5 px-4">
                        {p.role === 'petugas' ? (
                          assignedWh ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {assignedWh.split(', ').map((wName: string) => (
                                <span
                                  key={wName}
                                  className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200/80 text-teal-800 text-[10px] font-bold"
                                >
                                  Gudang {wName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-red-500">Belum ditugaskan</span>
                          )
                        ) : (
                          <span className="text-slate-500 font-medium text-[11px]">
                            Semua Gudang (WH2, WH3, WH4)
                          </span>
                        )}
                      </td>

                      {/* Kolom 4: Status Akun */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            p.active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.active ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
                            }`}
                          />
                          <span>{p.active ? 'Aktif' : 'Nonaktif'}</span>
                        </span>
                      </td>

                      {/* Kolom 5: Tombol Aksi Sejajar & Rapi */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Tombol Toggle Status */}
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleToggleActive(p.id, !!p.active, p.email)}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                              isSelf
                                ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100 border-slate-200'
                                : p.active
                                ? 'text-amber-800 bg-amber-50/70 border-amber-200/80 hover:bg-amber-100'
                                : 'text-emerald-800 bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100'
                            }`}
                            title={isSelf ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                          >
                            {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>

                          {/* Tombol Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition-all shadow-2xs"
                            title="Edit Data Pengguna"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Tombol Hapus */}
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(p)}
                            className={`p-1.5 rounded-lg border transition-all shadow-2xs ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50 border-slate-200/80 hover:border-red-200'
                            }`}
                            title={isSelf ? 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif' : 'Hapus Pengguna'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada data pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. MODAL TAMBAH / EDIT PENGGUNA (MODERN, NEAT, & DIRECT RESET) */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-xs ${
                    editingUser
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
                      : 'bg-gradient-to-br from-primary to-teal-700'
                  }`}
                >
                  {editingUser ? <Edit2 size={18} /> : <UserCheck size={18} />}
                </div>
                <div>
                  <h3 className="text-slate-900 text-sm font-black uppercase tracking-wider">
                    {editingUser ? 'Edit Data & Akses Pengguna' : 'Tambah Pengguna Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {editingUser
                      ? `Kelola hak akses atau reset kata sandi untuk ${editingUser.name}`
                      : 'Daftarkan akun petugas, supervisor, atau manajemen baru'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Scrollable */}
            <form onSubmit={handleSaveUser} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Alert Error */}
              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-semibold">{formError}</span>
                </div>
              )}

              {/* Alert Sukses Reset Kata Sandi */}
              {resetSuccessNotice && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs rounded-xl flex items-center justify-between gap-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="font-bold">{resetSuccessNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(resetPasswordInput)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition"
                  >
                    {copiedPassword ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPassword ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              )}

              {/* SEKSI 1: IDENTITAS PENGGUNA */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    1. Identitas &amp; Akun Login
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Nama Lengkap */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="input text-xs !pl-10 h-11"
                      />
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Alamat Email */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>Alamat Email <span className="text-red-500">*</span></span>
                      {editingUser && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          (Terkunci)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        disabled={!!editingUser}
                        placeholder="Contoh: budi@cekhidran.id"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="input text-xs !pl-10 h-11 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
                      />
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEKSI 2: PERAN & PENUGASAN GUDANG */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    2. Peran Sistem &amp; Area Penugasan
                  </span>
                </div>

                {/* Dropdown Role */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Peran Sistem (Role) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                    className="input text-xs font-semibold h-11"
                  >
                    <option value="petugas">Petugas Lapangan (Pemeriksa Hydrant Box)</option>
                    <option value="supervisor_k3">Supervisor K3 (Monitoring &amp; Verifikasi Temuan)</option>
                    <option value="admin_sistem">Admin Sistem (Akses Penuh Seluruh Konfigurasi)</option>
                    <option value="manajemen">Manajemen (Eksekutif Read-Only)</option>
                  </select>
                </div>

                {/* Pilihan Gudang Khusus Petugas */}
                {userForm.role === 'petugas' && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 size={13} className="text-primary" />
                      Penugasan Area Gudang:
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Pilih satu atau beberapa gudang yang menjadi tanggung jawab petugas ini:
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {warehouses.map((wh) => {
                        const isChecked = userForm.warehouseIds.includes(wh.id);
                        return (
                          <label
                            key={wh.id}
                            onClick={() => handleWarehouseCheckbox(wh.id)}
                            className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${
                              isChecked
                                ? 'bg-primary-50 border-primary text-primary-900 shadow-2xs ring-1 ring-primary/30'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="hidden"
                            />
                            <span>Gudang {wh.name}</span>
                            {isChecked && <Check size={13} className="text-primary shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SEKSI 3: KATA SANDI (ADD vs DIRECT RESET ON EDIT) */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    3. Keamanan &amp; Kata Sandi
                  </span>
                </div>

                {!editingUser ? (
                  /* MODE TAMBAH PENGGUNA */
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Lock size={13} className="text-slate-600" />
                        Kata Sandi Awal <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-primary hover:text-primary-700 flex items-center gap-1 hover:underline transition"
                      >
                        <Sparkles size={12} />
                        Buat Sandi Acak
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter (contoh: Petugas#12345)"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="input text-xs !pl-10 !pr-20 h-11 bg-white font-mono"
                      />
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {userForm.password && (
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(userForm.password)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                            title="Salin Kata Sandi"
                          >
                            {copiedPassword ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                          title={showPassword ? 'Sembunyikan' : 'Lihat Sandi'}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Kata sandi ini akan langsung aktif dan dapat digunakan pengguna untuk login pertama kali.
                    </p>
                  </div>
                ) : (
                  /* MODE EDIT PENGGUNA — RESET KATA SANDI LANGSUNG DI FORM (NO EMAIL) */
                  <div className="p-4 bg-gradient-to-br from-indigo-50/60 to-slate-50 border border-indigo-200/90 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <KeyRound size={14} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Reset Kata Sandi Langsung
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Ubah kata sandi akun di sini tanpa mengirim email
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline transition"
                      >
                        <Sparkles size={12} />
                        Acak Sandi
                      </button>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="relative">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          placeholder="Ketik kata sandi baru (kosongkan jika tidak diubah)"
                          value={resetPasswordInput}
                          onChange={(e) => setResetPasswordInput(e.target.value)}
                          className="input text-xs !pl-10 !pr-20 h-11 bg-white font-mono border-indigo-200 focus:border-indigo-500"
                        />
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {resetPasswordInput && (
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(resetPasswordInput)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                              title="Salin Kata Sandi"
                            >
                              {copiedPassword ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowResetPassword(!showResetPassword)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition"
                            title={showResetPassword ? 'Sembunyikan' : 'Lihat Sandi'}
                          >
                            {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      {resetPasswordInput.length > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-indigo-700 font-semibold">
                            {resetPasswordInput.length >= 6
                              ? '✓ Panjang sandi memenuhi syarat (min. 6)'
                              : '⚠️ Kurang dari 6 karakter'}
                          </span>
                          <button
                            type="button"
                            onClick={handleDirectResetPassword}
                            disabled={resetLoading || resetPasswordInput.length < 6}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs transition shadow-2xs"
                          >
                            {resetLoading ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Mereset…
                              </>
                            ) : (
                              <>
                                <KeyRound size={13} /> Terapkan Sandi Sekarang
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SEKSI 4: STATUS AKTIF */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    4. Status Akun
                  </span>
                </div>

                <div
                  onClick={() => setUserForm({ ...userForm, active: !userForm.active })}
                  className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                    userForm.active
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        userForm.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Power size={14} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Status Akun: {userForm.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        {userForm.active
                          ? 'Pengguna dapat masuk ke sistem dan menjalankan tugas sesuai peran.'
                          : 'Akses login pengguna ditangguhkan sementara.'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      userForm.active
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {userForm.active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                    {userForm.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi Modal */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  disabled={submitting}
                  className="btn-secondary text-xs px-4 py-2.5 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs px-5 py-2.5 font-bold flex items-center gap-2 shadow-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Menyimpan…
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} /> Simpan Pengguna
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
