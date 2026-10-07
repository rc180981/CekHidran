/**
 * Uji integrasi RLS terhadap proyek Supabase sungguhan (lokal atau cloud).
 * Dilewati otomatis bila variabel lingkungan belum diisi.
 *
 *   npm run test:rls
 *
 * Prasyarat: migrasi + seed.sql + `npm run seed:users` sudah dijalankan.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { beforeAll, describe, expect, it } from 'vitest';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const petugasEmail = process.env.RLS_TEST_PETUGAS_EMAIL ?? 'petugas@cekhidran.id';
const petugasPass = process.env.RLS_TEST_PETUGAS_PASSWORD ?? 'Petugas#12345';
const mgmtEmail = process.env.RLS_TEST_MANAJEMEN_EMAIL ?? 'manajemen@cekhidran.id';
const mgmtPass = process.env.RLS_TEST_MANAJEMEN_PASSWORD ?? 'Manajemen#12345';

const enabled = !!url && !!anon && !url.includes('xxxxxxxx');

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Gagal login ${email}: ${error.message}`);
  return c;
}

describe.skipIf(!enabled)('RLS Supabase', () => {
  let petugas: SupabaseClient;
  let manajemen: SupabaseClient;
  let wh2: { id: string };
  let wh3: { id: string };
  let hydrantWH2: { id: string; qr_code: string };
  let hydrantWH3: { id: string; qr_code: string };

  beforeAll(async () => {
    petugas = await signIn(petugasEmail, petugasPass);
    manajemen = await signIn(mgmtEmail, mgmtPass);
    const { data: whs } = await manajemen.from('warehouses').select('id, name');
    wh2 = whs!.find((w) => w.name === 'WH2')!;
    wh3 = whs!.find((w) => w.name === 'WH3')!;
    const { data: h2 } = await manajemen.from('hydrants').select('id, qr_code').eq('warehouse_id', wh2.id).limit(1).single();
    const { data: h3 } = await manajemen.from('hydrants').select('id, qr_code').eq('warehouse_id', wh3.id).limit(1).single();
    hydrantWH2 = h2!;
    hydrantWH3 = h3!;
  });

  describe('Petugas tidak bisa membuka gudang lain', () => {
    it('hanya melihat hydrant gudang WH2', async () => {
      const { data, error } = await petugas.from('hydrants').select('id, warehouse_id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.every((h) => h.warehouse_id === wh2.id)).toBe(true);
    });

    it('query langsung hydrant WH3 mengembalikan 0 baris', async () => {
      const { data } = await petugas.from('hydrants').select('id').eq('warehouse_id', wh3.id);
      expect(data).toEqual([]);
    });

    it('tidak bisa melihat pemeriksaan WH3', async () => {
      const { data } = await petugas.from('inspections').select('id, hydrant_id').eq('hydrant_id', hydrantWH3.id);
      expect(data).toEqual([]);
    });

    it('RPC submit_inspection untuk hydrant WH3 ditolak', async () => {
      const { error } = await petugas.rpc('submit_inspection', {
        p_id: randomUUID(),
        p_hydrant_id: hydrantWH3.id,
        p_qr_code: hydrantWH3.qr_code,
        p_inspected_at: new Date().toISOString(),
        p_notes: 'uji rls',
        p_results: [],
        p_photos: [],
      });
      expect(error).not.toBeNull();
    });

    it('insert langsung ke inspections untuk hydrant WH3 ditolak', async () => {
      const { data: me } = await petugas.auth.getUser();
      const { error } = await petugas.from('inspections').insert({
        id: randomUUID(), hydrant_id: hydrantWH3.id, inspector_id: me.user!.id,
      });
      expect(error).not.toBeNull();
    });

    it('tidak bisa membaca audit log', async () => {
      const { data } = await petugas.from('audit_logs').select('id').limit(1);
      expect(data).toEqual([]);
    });

    it('tidak bisa mengubah peran sendiri', async () => {
      const { data: me } = await petugas.auth.getUser();
      await petugas.from('profiles').update({ role: 'admin_sistem' }).eq('id', me.user!.id);
      const { data } = await petugas.from('profiles').select('role').eq('id', me.user!.id).single();
      expect(data!.role).toBe('petugas');
    });
  });

  describe('Manajemen tidak bisa mengisi checklist', () => {
    it('RPC submit_inspection ditolak', async () => {
      const { error } = await manajemen.rpc('submit_inspection', {
        p_id: randomUUID(),
        p_hydrant_id: hydrantWH2.id,
        p_qr_code: hydrantWH2.qr_code,
        p_inspected_at: new Date().toISOString(),
        p_notes: null,
        p_results: [],
        p_photos: [],
      });
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/petugas/i);
    });

    it('insert langsung ke inspections ditolak', async () => {
      const { data: me } = await manajemen.auth.getUser();
      const { error } = await manajemen.from('inspections').insert({
        id: randomUUID(), hydrant_id: hydrantWH2.id, inspector_id: me.user!.id,
      });
      expect(error).not.toBeNull();
    });

    it('tidak bisa menutup temuan', async () => {
      const { data: f } = await manajemen.from('findings').select('id, status').limit(1);
      if (!f?.length) return; // belum ada temuan
      await manajemen.from('findings').update({ status: 'selesai' }).eq('id', f[0].id);
      const { data: after } = await manajemen.from('findings').select('status').eq('id', f[0].id).single();
      expect(after!.status).toBe(f[0].status);
    });

    it('tidak bisa mengubah titik hydrant', async () => {
      const { data } = await manajemen.from('hydrants').update({ location_name: 'diretas' }).eq('id', hydrantWH2.id).select();
      expect(data ?? []).toEqual([]);
    });

    it('bisa melihat semua gudang (read-only)', async () => {
      const { data } = await manajemen.from('hydrants').select('warehouse_id');
      const set = new Set(data!.map((h) => h.warehouse_id));
      expect(set.has(wh2.id) && set.has(wh3.id)).toBe(true);
    });
  });
});
