import { NextRequest, NextResponse } from 'next/server';
import { assertPermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';
import { monthRange, monthLabel, jakartaMonth } from '@/lib/period';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await assertPermission('ekspor_laporan');
    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const bulan = searchParams.get('bulan') || jakartaMonth();

    const supabase = await createClient();

    let hydrantsQuery = supabase
      .from('hydrants')
      .select('id, number, type, location_name, location_type, warehouse_id, warehouses(name)')
      .eq('active', true)
      .order('warehouse_id')
      .order('number');

    if (warehouseId) {
      hydrantsQuery = hydrantsQuery.eq('warehouse_id', warehouseId);
    }

    const [{ data: hydrants }, { data: items }] = await Promise.all([
      hydrantsQuery,
      supabase.from('checklist_items').select('id, name, sort_order').eq('active', true).order('sort_order'),
    ]);

    const hydrantList = hydrants ?? [];
    const checklistItems = items ?? [];
    const { start, end } = monthRange(bulan);

    // Ambil semua inspeksi dalam bulan tersebut
    const hydrantIds = hydrantList.map((h) => h.id);
    const { data: inspections } = await supabase
      .from('inspections')
      .select(`
        id,
        hydrant_id,
        inspected_at,
        notes,
        status,
        profiles(name),
        inspection_results(checklist_item_id, result)
      `)
      .in('hydrant_id', hydrantIds.length > 0 ? hydrantIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('inspected_at', start.toISOString())
      .lt('inspected_at', end.toISOString())
      .order('inspected_at', { ascending: true });

    // Buat Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cek Hidran K3';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rekapitulasi Pemeriksaan');

    // Header Sheet
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'REKAPITULASI PEMERIKSAAN HYDRANT & EQUIPMENT K3';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0E7C86' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:H2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Periode: ${monthLabel(bulan)}`;
    subCell.font = { name: 'Arial', size: 10, italic: true };
    subCell.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // Kolom Tabel
    const headerRow = sheet.addRow([
      'Waktu Periksa',
      'Gudang',
      'No. Hydrant',
      'Lokasi Hydrant',
      'Petugas',
      'Status',
      'Catatan Kendala',
      ...checklistItems.map((it) => it.name),
    ]);

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0E7C86' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const hydrantMap = new Map(hydrantList.map((h: any) => [h.id, h]));

    (inspections ?? []).forEach((ins: any) => {
      const h = hydrantMap.get(ins.hydrant_id);
      const resMap = new Map((ins.inspection_results ?? []).map((r: any) => [r.checklist_item_id, r.result]));

      const rowData = [
        new Date(ins.inspected_at).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        h?.warehouses?.name ? `Gudang ${h.warehouses.name}` : '-',
        h?.number ?? '-',
        h?.location_name ?? '-',
        ins.profiles?.name ?? '-',
        ins.status === 'baik' ? 'Baik' : 'Tidak baik',
        ins.notes || '-',
      ];

      checklistItems.forEach((it) => {
        const res = resMap.get(it.id);
        rowData.push(res === 'baik' ? 'Baik' : res === 'tidak_baik' ? 'Tidak baik' : '-');
      });

      const row = sheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Sesuaikan lebar kolom
    sheet.columns.forEach((col) => {
      let maxLen = 14;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 10;
        if (len > maxLen) maxLen = Math.min(len + 3, 35);
      });
      col.width = maxLen;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rekap_Checksheet_${bulan}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Gagal membuat berkas Excel' }, { status: 500 });
  }
}
