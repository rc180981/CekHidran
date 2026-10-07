-- Seed data statis Cek Hidran (idempotent).
-- Pengguna contoh dibuat lewat: npm run seed:users (membutuhkan SUPABASE_SERVICE_ROLE_KEY)

insert into public.warehouses (name) values ('WH2'), ('WH3'), ('WH4')
on conflict (name) do nothing;

-- 18 titik per gudang: H-01..H-12 di dalam gudang, H-13..H-18 di luar gudang
insert into public.hydrants (warehouse_id, number, type, location_name, location_type)
select
  w.id,
  'H-' || lpad(n::text, 2, '0'),
  'Box Hydrant',
  case
    when n <= 12 then 'Dalam gudang – ' ||
      (array['Area Rak A', 'Area Rak B', 'Area Rak C', 'Dock Loading', 'Koridor Tengah', 'Area Staging'])[((n - 1) % 6) + 1]
      || ' ' || (((n - 1) / 6) + 1)
    else 'Luar gudang – ' ||
      (array['Sisi Utara', 'Sisi Timur', 'Sisi Selatan', 'Sisi Barat', 'Parkir Truk', 'Pos Jaga'])[n - 12]
  end,
  (case when n <= 12 then 'indoor' else 'outdoor' end)::public.location_type
from public.warehouses w
cross join generate_series(1, 18) as n
where w.name in ('WH2', 'WH3', 'WH4')
on conflict (warehouse_id, number) do nothing;

insert into public.checklist_items (name, description, sort_order) values
  ('Box Hydrant', 'Kondisi box: pintu, kaca, engsel, kunci, cat, dan label petunjuk', 1),
  ('Nozzle & Packing seal', 'Nozzle lengkap, tidak retak/penyok, packing seal terpasang baik', 2),
  ('Selang Hydrant', 'Selang tergulung rapi, tidak bocor, tidak getas atau berjamur', 3),
  ('Selang & Packing seal Hydrant', 'Kopling selang dan packing seal tidak aus, terpasang rapat', 4)
on conflict (name) do nothing;

insert into public.app_settings (key, value) values ('inspection_frequency', 'harian')
on conflict (key) do nothing;
