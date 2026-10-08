// Skrip seeder master data ke Firebase Firestore: 3 gudang, 54 hydrant, checklist items & akun pengguna
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD2sRyJ2pg50YnoqmG4W2zrKagK1u-a3KM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hidran-7d88c.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hidran-7d88c",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hidran-7d88c.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "616864462935",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:616864462935:web:a901af5bc1465d624f8b12",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-XS9L6TWF34"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const WAREHOUSES = [
  { id: 'wh2', name: 'WH2' },
  { id: 'wh3', name: 'WH3' },
  { id: 'wh4', name: 'WH4' }
];

const CHECKLIST_ITEMS = [
  { id: 'item_1', name: 'Box Hydrant', description: 'Kondisi box: pintu, kaca, engsel, kunci, cat, dan label petunjuk', sort_order: 1, active: true },
  { id: 'item_2', name: 'Nozzle & Packing seal', description: 'Nozzle lengkap, tidak retak/penyok, packing seal terpasang baik', sort_order: 2, active: true },
  { id: 'item_3', name: 'Selang Hydrant', description: 'Selang tergulung rapi, tidak bocor, tidak getas atau berjamur', sort_order: 3, active: true },
  { id: 'item_4', name: 'Selang & Packing seal Hydrant', description: 'Kopling selang dan packing seal tidak aus, terpasang rapat', sort_order: 4, active: true }
];

const USERS = [
  { email: 'admin@cekhidran.id', password: 'Admin#12345', name: 'Andi Admin', role: 'admin_sistem', warehouses: ['wh2', 'wh3', 'wh4'] },
  { email: 'supervisor@cekhidran.id', password: 'Supervisor#12345', name: 'Sari Supervisor K3', role: 'supervisor_k3', warehouses: ['wh2', 'wh3', 'wh4'] },
  { email: 'petugas@cekhidran.id', password: 'Petugas#12345', name: 'Budi Petugas', role: 'petugas', warehouses: ['wh2'] },
  { email: 'manajemen@cekhidran.id', password: 'Manajemen#12345', name: 'Maya Manajemen', role: 'manajemen', warehouses: ['wh2', 'wh3', 'wh4'] }
];

async function seed() {
  console.log('🚀 Memulai seeder Firebase untuk project hidran-7d88c...');

  // 1. Gudang
  for (const wh of WAREHOUSES) {
    await setDoc(doc(db, 'warehouses', wh.id), { ...wh, created_at: new Date().toISOString() }, { merge: true });
  }
  console.log('✓ 3 Gudang berhasil disimpan (WH2, WH3, WH4)');

  // 2. Checklist items
  for (const item of CHECKLIST_ITEMS) {
    await setDoc(doc(db, 'checklist_items', item.id), item, { merge: true });
  }
  console.log('✓ 4 Item equipment checklist tersimpan');

  // 3. Pengaturan default
  await setDoc(doc(db, 'app_settings', 'inspection_frequency'), {
    key: 'inspection_frequency',
    value: 'harian',
    updated_at: new Date().toISOString()
  }, { merge: true });
  console.log('✓ Pengaturan frekuensi default (harian) tersimpan');

  // 4. Hydrants (18 titik per gudang = 54 titik)
  const indoorAreas = ['Area Rak A', 'Area Rak B', 'Area Rak C', 'Dock Loading', 'Koridor Tengah', 'Area Staging'];
  const outdoorAreas = ['Sisi Utara', 'Sisi Timur', 'Sisi Selatan', 'Sisi Barat', 'Parkir Truk', 'Pos Jaga'];

  let count = 0;
  for (const wh of WAREHOUSES) {
    const batch = writeBatch(db);
    for (let i = 1; i <= 18; i++) {
      const numStr = String(i).padStart(2, '0');
      const id = `${wh.id}_H${numStr}`;
      const isIndoor = i <= 12;
      const location_type = isIndoor ? 'indoor' : 'outdoor';
      const location_name = isIndoor
        ? `Dalam gudang – ${indoorAreas[(i - 1) % 6]} ${Math.floor((i - 1) / 6) + 1}`
        : `Luar gudang – ${outdoorAreas[i - 13]}`;
      const qr_code = `CEKHIDRAN:${wh.name}:H-${numStr}`;

      const hRef = doc(db, 'hydrants', id);
      batch.set(hRef, {
        id,
        warehouse_id: wh.id,
        warehouse_name: wh.name,
        number: `H-${numStr}`,
        type: 'Box Hydrant',
        location_name,
        location_type,
        qr_code,
        active: true,
        created_at: new Date().toISOString()
      }, { merge: true });
      count++;
    }
    await batch.commit();
  }
  console.log(`✓ 54 Titik Hydrant berhasil disimpan (${count} titik di 3 gudang)`);

  // 5. Akun Pengguna
  console.log('\n👤 Membuat 4 akun pengguna di Firebase Auth...');
  for (const u of USERS) {
    let uid = '';
    try {
      const cred = await createUserWithEmailAndPassword(auth, u.email, u.password);
      uid = cred.user.uid;
      console.log(`✓ Berhasil dibuat di Auth: ${u.email}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, u.email, u.password);
        uid = cred.user.uid;
        console.log(`• Akun sudah ada, memperbarui data profil: ${u.email}`);
      } else {
        console.error(`✕ Gagal pada ${u.email}:`, err.message);
        continue;
      }
    }

    if (uid) {
      await setDoc(doc(db, 'profiles', uid), {
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role,
        warehouseIds: u.warehouses,
        active: true,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }
  }

  console.log('\n🎉 SEED FIREBASE SELESAI!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Error saat seeding:', e);
  process.exit(1);
});
