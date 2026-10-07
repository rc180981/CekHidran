import { describe, expect, it } from 'vitest';
import {
  can,
  canEditInspection,
  canViewWarehouse,
  checkInspectionSubmission,
  homePath,
  type Actor,
  type Permission,
  type Role,
} from '@/lib/rbac';

const WH2 = 'wh2-id';
const WH3 = 'wh3-id';

const petugasWH2: Actor = { id: 'u-petugas', role: 'petugas', warehouseIds: [WH2] };
const admin: Actor = { id: 'u-admin', role: 'admin_sistem', warehouseIds: [] };
const supervisor: Actor = { id: 'u-sup', role: 'supervisor_k3', warehouseIds: [] };
const manajemen: Actor = { id: 'u-mgmt', role: 'manajemen', warehouseIds: [] };

const hydrantWH2 = { warehouse_id: WH2, qr_code: 'qr-wh2-01', active: true };
const hydrantWH3 = { warehouse_id: WH3, qr_code: 'qr-wh3-01', active: true };

describe('Matriks izin sesuai spesifikasi', () => {
  const expected: Record<Permission, Role[]> = {
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
  const roles: Role[] = ['admin_sistem', 'supervisor_k3', 'petugas', 'manajemen'];

  for (const [perm, allowed] of Object.entries(expected) as [Permission, Role[]][]) {
    for (const role of roles) {
      it(`${role} ${allowed.includes(role) ? 'BOLEH' : 'TIDAK boleh'} ${perm}`, () => {
        expect(can(role, perm)).toBe(allowed.includes(role));
      });
    }
  }

  it('tanpa peran tidak punya izin apa pun', () => {
    expect(can(null, 'lihat_dashboard')).toBe(false);
    expect(can(undefined, 'isi_checklist')).toBe(false);
  });
});

describe('Petugas tidak bisa membuka gudang lain', () => {
  it('petugas WH2 bisa melihat WH2', () => {
    expect(canViewWarehouse(petugasWH2, WH2)).toBe(true);
  });
  it('petugas WH2 TIDAK bisa melihat WH3', () => {
    expect(canViewWarehouse(petugasWH2, WH3)).toBe(false);
  });
  it('petugas WH2 TIDAK bisa mengisi checklist hydrant WH3 walau QR benar', () => {
    const r = checkInspectionSubmission(petugasWH2, hydrantWH3, 'qr-wh3-01');
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it('petugas tanpa penugasan gudang tidak bisa melihat gudang mana pun', () => {
    const p: Actor = { id: 'x', role: 'petugas', warehouseIds: [] };
    expect(canViewWarehouse(p, WH2)).toBe(false);
  });
  it('admin, supervisor, manajemen melihat semua gudang', () => {
    for (const a of [admin, supervisor, manajemen]) {
      expect(canViewWarehouse(a, WH2)).toBe(true);
      expect(canViewWarehouse(a, WH3)).toBe(true);
    }
  });
});

describe('Manajemen tidak bisa mengisi checklist', () => {
  it('manajemen ditolak 403', () => {
    expect(checkInspectionSubmission(manajemen, hydrantWH2, 'qr-wh2-01')).toMatchObject({ ok: false, status: 403 });
  });
  it('admin & supervisor juga ditolak mengisi checklist', () => {
    expect(checkInspectionSubmission(admin, hydrantWH2, 'qr-wh2-01')).toMatchObject({ ok: false, status: 403 });
    expect(checkInspectionSubmission(supervisor, hydrantWH2, 'qr-wh2-01')).toMatchObject({ ok: false, status: 403 });
  });
  it('tanpa sesi ditolak 401', () => {
    expect(checkInspectionSubmission(null, hydrantWH2, 'qr-wh2-01')).toMatchObject({ ok: false, status: 401 });
  });
});

describe('Petugas wajib scan QR yang benar', () => {
  it('QR cocok → boleh', () => {
    expect(checkInspectionSubmission(petugasWH2, hydrantWH2, 'qr-wh2-01')).toEqual({ ok: true });
  });
  it('QR salah/kosong → 400', () => {
    expect(checkInspectionSubmission(petugasWH2, hydrantWH2, 'qr-lain')).toMatchObject({ ok: false, status: 400 });
    expect(checkInspectionSubmission(petugasWH2, hydrantWH2, '')).toMatchObject({ ok: false, status: 400 });
  });
  it('hydrant nonaktif → 403', () => {
    expect(checkInspectionSubmission(petugasWH2, { ...hydrantWH2, active: false }, 'qr-wh2-01')).toMatchObject({ ok: false, status: 403 });
  });
});

describe('Ubah checklist hanya hari berjalan', () => {
  const now = new Date('2026-10-07T10:00:00+07:00');
  const today = { warehouseId: WH2, inspectedAt: '2026-10-07T08:00:00+07:00' };
  const yesterday = { warehouseId: WH2, inspectedAt: '2026-10-06T23:59:00+07:00' };

  it('petugas gudang sendiri boleh mengubah hari ini', () => {
    expect(canEditInspection(petugasWH2, today, now)).toBe(true);
  });
  it('petugas tidak boleh mengubah gudang lain', () => {
    expect(canEditInspection(petugasWH2, { ...today, warehouseId: WH3 }, now)).toBe(false);
  });
  it('tidak ada yang boleh mengubah pemeriksaan kemarin', () => {
    for (const a of [petugasWH2, admin, supervisor]) expect(canEditInspection(a, yesterday, now)).toBe(false);
  });
  it('admin & supervisor boleh, manajemen tidak', () => {
    expect(canEditInspection(admin, today, now)).toBe(true);
    expect(canEditInspection(supervisor, today, now)).toBe(true);
    expect(canEditInspection(manajemen, today, now)).toBe(false);
  });
  it('batas hari mengikuti WIB, bukan UTC', () => {
    // 2026-10-06T18:00Z = 07 Okt 01:00 WIB → masih "hari ini"
    expect(canEditInspection(petugasWH2, { warehouseId: WH2, inspectedAt: '2026-10-06T18:00:00Z' }, now)).toBe(true);
  });
});

describe('Beranda per peran', () => {
  it('petugas ke antarmuka mobile, lainnya ke dashboard', () => {
    expect(homePath('petugas')).toBe('/petugas');
    expect(homePath('admin_sistem')).toBe('/dashboard');
    expect(homePath('manajemen')).toBe('/dashboard');
  });
});
