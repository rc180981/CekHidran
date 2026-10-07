// Membuat 4 pengguna contoh (satu per peran) memakai Supabase Admin API.
// Jalankan setelah migrasi + seed.sql:  npm run seed:users
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export const SAMPLE_USERS = [
  { email: 'admin@cekhidran.id', password: 'Admin#12345', name: 'Andi Admin', role: 'admin_sistem', warehouses: [] },
  { email: 'supervisor@cekhidran.id', password: 'Supervisor#12345', name: 'Sari Supervisor K3', role: 'supervisor_k3', warehouses: [] },
  { email: 'petugas@cekhidran.id', password: 'Petugas#12345', name: 'Budi Petugas', role: 'petugas', warehouses: ['WH2'] },
  { email: 'manajemen@cekhidran.id', password: 'Manajemen#12345', name: 'Maya Manajemen', role: 'manajemen', warehouses: [] },
];

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

const { data: warehouses, error: whErr } = await admin.from('warehouses').select('id, name');
if (whErr) throw whErr;
if (!warehouses?.length) {
  console.error('Tabel warehouses kosong. Jalankan supabase/seed.sql terlebih dahulu.');
  process.exit(1);
}

for (const u of SAMPLE_USERS) {
  let user = await findUserByEmail(u.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name },
      app_metadata: { role: u.role },
    });
    if (error) throw error;
    user = data.user;
    console.log(`✓ Dibuat: ${u.email}`);
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      password: u.password,
      user_metadata: { name: u.name },
      app_metadata: { role: u.role },
    });
    console.log(`• Diperbarui: ${u.email}`);
  }

  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id: user.id, name: u.name, role: u.role, active: true });
  if (pErr) throw pErr;

  await admin.from('user_warehouses').delete().eq('user_id', user.id);
  const rows = u.warehouses
    .map((name) => warehouses.find((w) => w.name === name))
    .filter(Boolean)
    .map((w) => ({ user_id: user.id, warehouse_id: w.id }));
  if (rows.length) {
    const { error } = await admin.from('user_warehouses').insert(rows);
    if (error) throw error;
  }
}

console.log('\nAkun contoh:');
for (const u of SAMPLE_USERS) console.log(`  ${u.role.padEnd(14)} ${u.email.padEnd(26)} ${u.password}`);
