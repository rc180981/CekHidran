-- =====================================================================
-- Cek Hidran — skema awal, RBAC (RLS), trigger audit & temuan, storage
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Enum ----------
create type public.user_role as enum ('admin_sistem', 'supervisor_k3', 'petugas', 'manajemen');
create type public.location_type as enum ('indoor', 'outdoor');
create type public.check_result as enum ('baik', 'tidak_baik');
create type public.inspection_status as enum ('baik', 'tidak_baik');
create type public.finding_status as enum ('terbuka', 'dalam_perbaikan', 'selesai');

-- ---------- Tabel ----------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null default 'petugas',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_warehouses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  primary key (user_id, warehouse_id)
);

create table public.hydrants (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  number text not null,
  type text not null default 'Box Hydrant',
  location_name text not null,
  location_type public.location_type not null default 'indoor',
  qr_code text not null unique default encode(gen_random_bytes(12), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (warehouse_id, number)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  hydrant_id uuid not null references public.hydrants (id) on delete cascade,
  inspector_id uuid not null references public.profiles (id),
  inspected_at timestamptz not null default now(),
  status public.inspection_status not null default 'baik',
  notes text check (char_length(notes) <= 1000),
  signature_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspections_hydrant_time_idx on public.inspections (hydrant_id, inspected_at desc);
create index inspections_time_idx on public.inspections (inspected_at desc);

create table public.inspection_results (
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items (id) on delete restrict,
  result public.check_result not null,
  primary key (inspection_id, checklist_item_id)
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  url text not null, -- path objek di bucket storage "inspeksi"
  taken_at timestamptz not null default now(),
  unique (inspection_id, url)
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  checklist_item_id uuid references public.checklist_items (id) on delete set null,
  description text not null,
  status public.finding_status not null default 'terbuka',
  resolution_notes text,
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (inspection_id, checklist_item_id)
);
create index findings_status_idx on public.findings (status, created_at desc);

create table public.audit_logs (
  id bigserial primary key,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  "timestamp" timestamptz not null default now(),
  details jsonb
);
create index audit_logs_time_idx on public.audit_logs ("timestamp" desc);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('inspection_frequency', 'harian');
alter table public.app_settings
  add constraint app_settings_frequency_chk
  check (key <> 'inspection_frequency' or value in ('harian', 'bulanan'));

-- ---------- Fungsi helper RBAC (security definer agar tidak rekursif di RLS) ----------
create or replace function public.app_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_role(roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role()::text = any (roles), false)
$$;

create or replace function public.is_assigned_warehouse(wh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_warehouses
    where user_id = auth.uid() and warehouse_id = wh
  )
$$;

-- admin/supervisor/manajemen: semua gudang; petugas: hanya gudang yang ditugaskan
create or replace function public.can_view_warehouse(wh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin_sistem', 'supervisor_k3', 'manajemen'])
      or (public.app_role() = 'petugas' and public.is_assigned_warehouse(wh))
$$;

create or replace function public.hydrant_warehouse(h uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select warehouse_id from public.hydrants where id = h
$$;

create or replace function public.inspection_warehouse(i uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select h.warehouse_id from public.inspections ins
  join public.hydrants h on h.id = ins.hydrant_id
  where ins.id = i
$$;

create or replace function public.jakarta_date(ts timestamptz)
returns date language sql stable as $$
  select (ts at time zone 'Asia/Jakarta')::date
$$;

-- Ubah checklist hari berjalan: admin, supervisor, petugas (gudang sendiri)
create or replace function public.can_edit_inspection(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inspections ins
    join public.hydrants h on h.id = ins.hydrant_id
    where ins.id = i
      and public.jakarta_date(ins.inspected_at) = public.jakarta_date(now())
      and (
        public.has_role(array['admin_sistem', 'supervisor_k3'])
        or (public.app_role() = 'petugas' and public.is_assigned_warehouse(h.warehouse_id))
      )
  )
$$;

create or replace function public.is_inspector_of(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.inspections where id = i and inspector_id = auth.uid())
$$;

-- ---------- Trigger: profil otomatis saat user dibuat ----------
-- Peran diambil dari raw_app_meta_data (hanya bisa diisi service role), bukan dari user_metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'petugas')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger: jaga field inspeksi yang tidak boleh berubah ----------
create or replace function public.guard_inspection_update()
returns trigger language plpgsql as $$
begin
  if new.hydrant_id <> old.hydrant_id
     or new.inspector_id <> old.inspector_id
     or new.inspected_at <> old.inspected_at then
    raise exception 'Hydrant, petugas, dan waktu pemeriksaan tidak boleh diubah';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger inspections_guard
  before update on public.inspections
  for each row execute function public.guard_inspection_update();

-- ---------- Trigger: item "Tidak baik" otomatis membuat temuan + status inspeksi ----------
create or replace function public.handle_result_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status public.inspection_status;
begin
  if new.result = 'tidak_baik' then
    insert into public.findings (inspection_id, checklist_item_id, description)
    select new.inspection_id, new.checklist_item_id,
           ci.name || ' — Tidak baik' || coalesce('. Catatan: ' || nullif(trim(i.notes), ''), '')
    from public.checklist_items ci, public.inspections i
    where ci.id = new.checklist_item_id and i.id = new.inspection_id
    on conflict (inspection_id, checklist_item_id) do nothing;
  elsif tg_op = 'UPDATE' and old.result = 'tidak_baik' then
    -- koreksi di hari yang sama: hapus temuan yang belum ditindaklanjuti
    delete from public.findings
    where inspection_id = new.inspection_id
      and checklist_item_id = new.checklist_item_id
      and status = 'terbuka';
  end if;

  select case when exists (
    select 1 from public.inspection_results
    where inspection_id = new.inspection_id and result = 'tidak_baik'
  ) then 'tidak_baik'::public.inspection_status else 'baik'::public.inspection_status end
  into v_status;

  update public.inspections set status = v_status
  where id = new.inspection_id and status is distinct from v_status;
  return new;
end $$;

create trigger inspection_results_findings
  after insert or update on public.inspection_results
  for each row execute function public.handle_result_change();

-- ---------- Trigger: closed_by/closed_at temuan diisi server ----------
create or replace function public.handle_finding_update()
returns trigger language plpgsql as $$
begin
  if new.status = 'selesai' and old.status is distinct from 'selesai' then
    new.closed_by := auth.uid();
    new.closed_at := now();
  elsif new.status <> 'selesai' then
    new.closed_by := null;
    new.closed_at := null;
  end if;
  return new;
end $$;

create trigger findings_close
  before update on public.findings
  for each row execute function public.handle_finding_update();

-- ---------- Trigger audit log generik ----------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'inspection_id', rec ->> 'user_id', rec ->> 'key'),
    case when tg_op = 'UPDATE'
      then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else rec end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'warehouses', 'profiles', 'user_warehouses', 'hydrants', 'checklist_items',
    'inspections', 'inspection_results', 'inspection_photos', 'findings', 'app_settings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_trigger()', t || '_audit', t);
  end loop;
end $$;

-- ---------- RPC: simpan pemeriksaan (atomic, idempotent, RLS tetap berlaku) ----------
create or replace function public.submit_inspection(
  p_id uuid,
  p_hydrant_id uuid,
  p_qr_code text,
  p_inspected_at timestamptz,
  p_notes text,
  p_results jsonb,  -- [{checklist_item_id, result}]
  p_photos jsonb    -- [{url, taken_at}]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_qr text;
  v_count int;
begin
  if public.app_role() is distinct from 'petugas' then
    raise exception 'Hanya petugas yang dapat mengisi checklist' using errcode = '42501';
  end if;

  select qr_code into v_qr from public.hydrants
  where id = p_hydrant_id and active and public.is_assigned_warehouse(warehouse_id);
  if v_qr is null then
    raise exception 'Hydrant tidak ditemukan atau bukan gudang yang ditugaskan' using errcode = '42501';
  end if;
  if v_qr <> p_qr_code then
    raise exception 'QR code tidak cocok dengan titik hydrant' using errcode = '22023';
  end if;

  -- idempotent untuk sinkronisasi offline
  if exists (select 1 from public.inspections where id = p_id) then
    return p_id;
  end if;

  if p_inspected_at > now() + interval '10 minutes' or p_inspected_at < now() - interval '14 days' then
    raise exception 'Waktu pemeriksaan tidak valid' using errcode = '22023';
  end if;

  insert into public.inspections (id, hydrant_id, inspector_id, inspected_at, notes, signature_url)
  values (p_id, p_hydrant_id, auth.uid(), p_inspected_at, nullif(trim(p_notes), ''), p_id::text || '/ttd.png');

  insert into public.inspection_results (inspection_id, checklist_item_id, result)
  select p_id, (r ->> 'checklist_item_id')::uuid, (r ->> 'result')::public.check_result
  from jsonb_array_elements(p_results) r;

  if exists (
    select 1 from public.checklist_items ci
    where ci.active and not exists (
      select 1 from public.inspection_results ir
      where ir.inspection_id = p_id and ir.checklist_item_id = ci.id
    )
  ) then
    raise exception 'Semua item checklist wajib diisi' using errcode = '22023';
  end if;

  insert into public.inspection_photos (inspection_id, url, taken_at)
  select p_id, ph ->> 'url', coalesce((ph ->> 'taken_at')::timestamptz, now())
  from jsonb_array_elements(p_photos) ph
  where (ph ->> 'url') like p_id::text || '/%';

  select count(*) into v_count from public.inspection_photos where inspection_id = p_id;
  if v_count < 1 or v_count > 3 then
    raise exception 'Foto kondisi wajib minimal 1 dan maksimal 3' using errcode = '22023';
  end if;

  return p_id;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.warehouses enable row level security;
alter table public.profiles enable row level security;
alter table public.user_warehouses enable row level security;
alter table public.hydrants enable row level security;
alter table public.checklist_items enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_results enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.findings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

-- warehouses
create policy warehouses_select on public.warehouses for select to authenticated using (true);
create policy warehouses_admin on public.warehouses for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- profiles (nama & peran boleh dilihat sesama pengguna aktif; hanya admin yang mengubah)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_role() is not null);
create policy profiles_admin on public.profiles for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- user_warehouses
create policy user_warehouses_select on public.user_warehouses for select to authenticated
  using (user_id = auth.uid() or public.has_role(array['admin_sistem', 'supervisor_k3', 'manajemen']));
create policy user_warehouses_admin on public.user_warehouses for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- hydrants
create policy hydrants_select on public.hydrants for select to authenticated
  using (public.can_view_warehouse(warehouse_id));
create policy hydrants_admin on public.hydrants for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- checklist_items
create policy checklist_items_select on public.checklist_items for select to authenticated using (true);
create policy checklist_items_admin on public.checklist_items for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- app_settings
create policy app_settings_select on public.app_settings for select to authenticated using (true);
create policy app_settings_admin on public.app_settings for all to authenticated
  using (public.has_role(array['admin_sistem'])) with check (public.has_role(array['admin_sistem']));

-- inspections
create policy inspections_select on public.inspections for select to authenticated
  using (public.can_view_warehouse(public.hydrant_warehouse(hydrant_id)));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (
    public.app_role() = 'petugas'
    and inspector_id = auth.uid()
    and public.is_assigned_warehouse(public.hydrant_warehouse(hydrant_id))
  );
create policy inspections_update on public.inspections for update to authenticated
  using (public.can_edit_inspection(id)) with check (public.can_edit_inspection(id));
create policy inspections_delete on public.inspections for delete to authenticated
  using (public.has_role(array['admin_sistem']));

-- inspection_results
create policy results_select on public.inspection_results for select to authenticated
  using (public.can_view_warehouse(public.inspection_warehouse(inspection_id)));
create policy results_insert on public.inspection_results for insert to authenticated
  with check (
    (public.app_role() = 'petugas' and public.is_inspector_of(inspection_id))
    or public.can_edit_inspection(inspection_id)
  );
create policy results_update on public.inspection_results for update to authenticated
  using (public.can_edit_inspection(inspection_id)) with check (public.can_edit_inspection(inspection_id));
create policy results_delete on public.inspection_results for delete to authenticated
  using (public.can_edit_inspection(inspection_id));

-- inspection_photos
create policy photos_select on public.inspection_photos for select to authenticated
  using (public.can_view_warehouse(public.inspection_warehouse(inspection_id)));
create policy photos_insert on public.inspection_photos for insert to authenticated
  with check (
    (public.app_role() = 'petugas' and public.is_inspector_of(inspection_id))
    or public.can_edit_inspection(inspection_id)
  );
create policy photos_delete on public.inspection_photos for delete to authenticated
  using (public.can_edit_inspection(inspection_id));

-- findings: dibuat otomatis oleh trigger; verifikasi & tutup hanya admin/supervisor
create policy findings_select on public.findings for select to authenticated
  using (public.can_view_warehouse(public.inspection_warehouse(inspection_id)));
create policy findings_insert on public.findings for insert to authenticated
  with check (public.has_role(array['admin_sistem', 'supervisor_k3']));
create policy findings_update on public.findings for update to authenticated
  using (public.has_role(array['admin_sistem', 'supervisor_k3']))
  with check (public.has_role(array['admin_sistem', 'supervisor_k3']));
create policy findings_delete on public.findings for delete to authenticated
  using (public.has_role(array['admin_sistem']));

-- audit_logs: hanya dibaca admin; ditulis oleh trigger (security definer)
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_role(array['admin_sistem']));

-- =====================================================================
-- Storage: bucket privat "inspeksi" (foto kondisi & tanda tangan)
-- path: <inspection_id>/foto-1.jpg, <inspection_id>/ttd.png
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspeksi', 'inspeksi', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.path_inspection_id(p text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create or replace function public.can_view_inspection(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_view_warehouse(public.inspection_warehouse(i))
$$;

create or replace function public.can_upload_inspection_file(i uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (public.app_role() = 'petugas' and public.is_inspector_of(i)) or public.can_edit_inspection(i)
$$;

create policy inspeksi_read on storage.objects for select to authenticated
  using (bucket_id = 'inspeksi' and public.can_view_inspection(public.path_inspection_id(name)));
create policy inspeksi_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'inspeksi' and public.can_upload_inspection_file(public.path_inspection_id(name)));
create policy inspeksi_update on storage.objects for update to authenticated
  using (bucket_id = 'inspeksi' and public.can_upload_inspection_file(public.path_inspection_id(name)))
  with check (bucket_id = 'inspeksi' and public.can_upload_inspection_file(public.path_inspection_id(name)));
