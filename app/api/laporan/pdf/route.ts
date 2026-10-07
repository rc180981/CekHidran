import { NextRequest, NextResponse } from 'next/server';
import { assertPermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthRange, monthLabel, jakartaMonth } from '@/lib/period';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await assertPermission('ekspor_laporan');
    const searchParams = request.nextUrl.searchParams;
    const hydrantId = searchParams.get('hydrantId');
    const bulan = searchParams.get('bulan') || jakartaMonth();

    if (!hydrantId) {
      return NextResponse.json({ error: 'Parameter hydrantId wajib diisi' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Ambil detail hydrant, items checklist, dan inspeksi
    const [{ data: hydrant }, { data: items }] = await Promise.all([
      supabase
        .from('hydrants')
        .select('id, number, type, location_name, location_type, warehouses(name)')
        .eq('id', hydrantId)
        .single(),
      supabase.from('checklist_items').select('id, name, sort_order').eq('active', true).order('sort_order'),
    ]);

    if (!hydrant) {
      return NextResponse.json({ error: 'Hydrant tidak ditemukan' }, { status: 404 });
    }

    const { start, end, days } = monthRange(bulan);

    const { data: inspections } = await supabase
      .from('inspections')
      .select(`
        id,
        inspected_at,
        notes,
        profiles(name),
        inspection_results(checklist_item_id, result)
      `)
      .eq('hydrant_id', hydrantId)
      .gte('inspected_at', start.toISOString())
      .lt('inspected_at', end.toISOString());

    const inspectionsByDate: Record<string, any> = {};
    (inspections ?? []).forEach((ins: any) => {
      const dKey = new Date(ins.inspected_at).toISOString().slice(0, 10);
      inspectionsByDate[dKey] = ins;
    });

    // 2. Susun PDF Ukuran A4 Landscape
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Judul & Header Dokumen
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LEMBAR CHECKSHEET PEMERIKSAAN HYDRANT BOX', 148, 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode Bulan: ${monthLabel(bulan)}`, 148, 19, { align: 'center' });

    // Kotak Identitas Hydrant
    doc.setDrawColor(180, 190, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 23, 269, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`No. Hydrant: ${(hydrant as any).number}`, 18, 29);
    doc.text(`Gudang: ${(hydrant as any).warehouses?.name}`, 78, 29);
    doc.text(`Jenis: ${(hydrant as any).type}`, 138, 29);
    doc.text(`Posisi: ${(hydrant as any).location_type === 'indoor' ? 'Dalam Gudang' : 'Luar Gudang'}`, 208, 29);

    doc.setFont('helvetica', 'normal');
    doc.text(`Lokasi: ${(hydrant as any).location_name}`, 18, 34);

    // Tabel Format Checksheet Kertas
    const checklistItems = items ?? [];
    const tableHeaders = [
      'Tgl',
      ...checklistItems.map((it) => it.name),
      'Catatan Kendala / Kondisi',
      'TTD Petugas',
    ];

    const tableRows = days.map((dayStr) => {
      const ins = inspectionsByDate[dayStr];
      const dayNum = dayStr.slice(8);
      const resMap = new Map((ins?.inspection_results ?? []).map((r: any) => [r.checklist_item_id, r.result]));

      const rowValues = [dayNum];
      checklistItems.forEach((it) => {
        const res = resMap.get(it.id);
        if (res === 'baik') rowValues.push('✓ Baik');
        else if (res === 'tidak_baik') rowValues.push('✕ Rusak');
        else rowValues.push('-');
      });

      rowValues.push(ins?.notes || (ins ? 'Nihil' : '-'));
      rowValues.push(ins?.profiles?.name ? `${ins.profiles.name} (✓)` : '-');
      return rowValues;
    });

    autoTable(doc, {
      startY: 40,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.2,
        halign: 'center',
        valign: 'middle',
        lineColor: [148, 163, 184],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [14, 124, 134],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10, fontStyle: 'bold' },
        [checklistItems.length + 1]: { cellWidth: 65, halign: 'left' },
        [checklistItems.length + 2]: { cellWidth: 32 },
      },
      margin: { left: 14, right: 14, bottom: 12 },
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Checksheet_${(hydrant as any).number}_${bulan}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Gagal membuat laporan PDF' }, { status: 500 });
  }
}
