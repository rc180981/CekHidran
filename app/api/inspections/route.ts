import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertPermission, errorResponse } from '@/lib/auth';
import { checkInspectionSubmission } from '@/lib/rbac';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MetaSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  hydrantId: z.string().uuid(),
  qrCode: z.string().min(1).max(200),
  inspectedAt: z.string().datetime({ offset: true }),
  notes: z.string().max(1000).default(''),
  results: z
    .array(z.object({ checklistItemId: z.string().uuid(), result: z.enum(['baik', 'tidak_baik']) }))
    .min(1)
    .max(50),
  photos: z.array(z.object({ takenAt: z.string().datetime({ offset: true }) })).min(1).max(3),
});

const MAX_FILE = 4 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Simpan pemeriksaan (dipakai langsung & oleh sinkronisasi antrean offline).
 * Idempotent berdasarkan id pemeriksaan yang dibuat di perangkat.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await assertPermission('isi_checklist');
    const form = await req.formData();

    let meta: z.infer<typeof MetaSchema>;
    try {
      meta = MetaSchema.parse(JSON.parse(String(form.get('meta') ?? '')));
    } catch {
      return NextResponse.json({ error: 'Data pemeriksaan tidak lengkap atau tidak valid.' }, { status: 400 });
    }
    if (meta.userId !== user.id) {
      return NextResponse.json(
        { error: 'Pemeriksaan ini dibuat oleh akun lain di perangkat ini. Masuk dengan akun tersebut untuk mengirim.' },
        { status: 403 },
      );
    }

    const photos = meta.photos.map((_, i) => form.get(`photo_${i}`));
    const signature = form.get('signature');
    const files = [...photos, signature];
    if (files.some((f) => !(f instanceof File) || f.size === 0 || f.size > MAX_FILE || !IMAGE_TYPES.includes(f.type))) {
      return NextResponse.json({ error: 'Foto kondisi (1–3) dan tanda tangan wajib dilampirkan.' }, { status: 400 });
    }

    const supabase = await createClient();

    // Pengecekan server (selain RLS): gudang yang ditugaskan + QR cocok
    const { data: hydrant } = await supabase
      .from('hydrants')
      .select('id, warehouse_id, qr_code, active')
      .eq('id', meta.hydrantId)
      .maybeSingle();
    const check = checkInspectionSubmission(user, hydrant, meta.qrCode);
    if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

    const photoPaths = photos.map((_, i) => `${meta.id}/foto-${i + 1}.jpg`);
    const signaturePath = `${meta.id}/ttd.png`;

    const { error: rpcError } = await supabase.rpc('submit_inspection', {
      p_id: meta.id,
      p_hydrant_id: meta.hydrantId,
      p_qr_code: meta.qrCode,
      p_inspected_at: meta.inspectedAt,
      p_notes: meta.notes,
      p_results: meta.results.map((r) => ({ checklist_item_id: r.checklistItemId, result: r.result })),
      p_photos: photoPaths.map((url, i) => ({ url, taken_at: meta.photos[i].takenAt })),
    });
    if (rpcError) {
      const status = rpcError.code === '42501' ? 403 : 400;
      return NextResponse.json({ error: rpcError.message }, { status });
    }

    const uploads = [
      ...photos.map((f, i) => ({ path: photoPaths[i], file: f as File })),
      { path: signaturePath, file: signature as File },
    ];
    for (const u of uploads) {
      const { error } = await supabase.storage
        .from('inspeksi')
        .upload(u.path, u.file, { contentType: u.file.type, upsert: true });
      if (error) {
        // data utama sudah tersimpan; klien akan mencoba ulang (idempotent)
        return NextResponse.json({ error: `Gagal mengunggah berkas: ${error.message}` }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, id: meta.id });
  } catch (e) {
    return errorResponse(e);
  }
}
