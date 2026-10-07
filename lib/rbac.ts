/**
 * Aturan RBAC Cek Hidran (sumber kebenaran di sisi aplikasi).
 * Aturan yang sama ditegakkan di database lewat RLS (lihat supabase/migrations).
 */
import { jakartaDate } from './period';

export const ROLES = ['admin_sistem', 'supervisor_k3', 'petugas', 'manajemen'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin_sistem: 'Admin Sistem',
  supervisor_k3: 'Supervisor K3',
  petugas: 'Petugas',
  manajemen: 'Manajemen',
};

export type Permission =
  | 'lihat_dashboard'
  | 'isi_checklist'
  | 'ubah_checklist_hari_ini'
  | 'verifikasi_temuan'
  | 'kelola_hydrant'
  | 'kelola_pengguna'
  | 'kelola_pengaturan'
  | 'ekspor_laporan'
  | 'lihat_riwayat_semua'
  | 'lihat_audit';

export const PERMISSIONS: Record<Permission, readonly Role[]> = {
  // petugas hanya melihat gudang sendiri (dibatasi lewat canViewWarehouse + RLS)
  lihat_dashboard: ['admin_sistem', 'supervisor_k3', 'petugas', 'manajemen'],
  isi_checklist: ['petugas'],
  ubah_checklist_hari_ini: ['admin_sistem', 'supervisor_k3', 'petugas'],
  verifikasi_temuan: ['admin_sistem', 'supervisor_k3'],
  kelola_hydrant: ['admin_sistem'],
  kelola_pengguna: ['admin_sistem'],
  kelola_pengaturan: ['admin_sistem'],
  ekspor_laporan: ['admin_sistem', 'supervisor_k3', 'manajemen'],
  lihat_riwayat_semua: ['admin_sistem', 'supervisor_k3', 'manajemen'],
  lihat_audit: ['admin_sistem'],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export interface Actor {
  id: string;
  role: Role;
  warehouseIds: string[];
}

/** Admin/supervisor/manajemen: semua gudang. Petugas: hanya gudang yang ditugaskan. */
export function canViewWarehouse(actor: Actor, warehouseId: string): boolean {
  if (can(actor.role, 'lihat_riwayat_semua')) return true;
  return actor.role === 'petugas' && actor.warehouseIds.includes(warehouseId);
}

export type CheckResult = { ok: true } | { ok: false; status: 400 | 401 | 403; message: string };

/**
 * Validasi server sebelum petugas menyimpan pemeriksaan:
 * hanya petugas, hanya gudang yang ditugaskan, dan QR yang di-scan harus cocok.
 */
export function checkInspectionSubmission(
  actor: Actor | null,
  hydrant: { warehouse_id: string; qr_code: string; active?: boolean } | null,
  scannedQr: string,
): CheckResult {
  if (!actor) return { ok: false, status: 401, message: 'Sesi berakhir, silakan masuk kembali.' };
  if (!can(actor.role, 'isi_checklist'))
    return { ok: false, status: 403, message: 'Hanya petugas yang dapat mengisi checklist.' };
  if (!hydrant || hydrant.active === false || !actor.warehouseIds.includes(hydrant.warehouse_id))
    return { ok: false, status: 403, message: 'Titik hydrant bukan bagian dari gudang yang ditugaskan.' };
  if (!scannedQr || hydrant.qr_code !== scannedQr)
    return { ok: false, status: 400, message: 'QR code tidak cocok. Scan ulang QR pada box hydrant.' };
  return { ok: true };
}

/** Ubah checklist hanya pada hari berjalan (WIB). Petugas hanya gudang sendiri. */
export function canEditInspection(
  actor: Actor,
  inspection: { warehouseId: string; inspectedAt: string | Date },
  now: Date = new Date(),
): boolean {
  if (!can(actor.role, 'ubah_checklist_hari_ini')) return false;
  if (jakartaDate(inspection.inspectedAt) !== jakartaDate(now)) return false;
  if (actor.role === 'petugas') return actor.warehouseIds.includes(inspection.warehouseId);
  return true;
}

export function homePath(role: Role): string {
  return role === 'petugas' ? '/petugas' : '/dashboard';
}
