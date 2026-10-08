'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { jakartaMonth, monthRange, monthLabel } from '@/lib/period';
import { FileText, FileSpreadsheet, Download, Loader2, Building2, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export default function EksporLaporanPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Form State PDF
  const [pdfWarehouseFilter, setPdfWarehouseFilter] = useState<string>('all');
  const [pdfHydrantId, setPdfHydrantId] = useState<string>('');
  const [pdfBulan, setPdfBulan] = useState<string>(jakartaMonth());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Form State Excel
  const [excelWarehouseId, setExcelWarehouseId] = useState<string>('all');
  const [excelBulan, setExcelBulan] = useState<string>(jakartaMonth());
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [wSnap, hSnap, iSnap, insSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'warehouses')),
        getDocs(collection(db, 'hydrants')),
        getDocs(collection(db, 'checklist_items')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'profiles')),
      ]);

      const wList: any[] = [];
      wSnap.forEach((d) => wList.push(d.data()));
      wList.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(wList);

      const hList: any[] = [];
      hSnap.forEach((d) => hList.push(d.data()));
      hList.sort((a, b) => a.number.localeCompare(b.number));
      setHydrants(hList);
      if (hList.length > 0) setPdfHydrantId(hList[0].id);

      const itList: any[] = [];
      iSnap.forEach((d) => itList.push(d.data()));
      itList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setItems(itList);

      const inList: any[] = [];
      insSnap.forEach((d) => inList.push(d.data()));
      setInspections(inList);

      const prList: any[] = [];
      pSnap.forEach((d) => prList.push(d.data()));
      setProfiles(prList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPdfHydrants =
    pdfWarehouseFilter === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === pdfWarehouseFilter);

  useEffect(() => {
    if (filteredPdfHydrants.length > 0 && !filteredPdfHydrants.some((h) => h.id === pdfHydrantId)) {
      setPdfHydrantId(filteredPdfHydrants[0].id);
    }
  }, [pdfWarehouseFilter, filteredPdfHydrants, pdfHydrantId]);

  // ================= EXPORT PDF =================
  const handleExportPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfHydrantId) return;

    setGeneratingPdf(true);
    setSuccessMsg(null);

    try {
      const hydrant = hydrants.find((h) => h.id === pdfHydrantId);
      if (!hydrant) throw new Error('Titik Hydrant tidak ditemukan.');

      const { days } = monthRange(pdfBulan);

      // Filter inspeksi untuk hydrant ini pada bulan yang dipilih
      const monthPrefix = pdfBulan; // YYYY-MM
      const hydrantInspections = inspections.filter(
        (ins) => ins.hydrant_id === pdfHydrantId && (ins.inspected_at || '').startsWith(monthPrefix)
      );

      const inspectionsByDate: Record<string, any> = {};
      hydrantInspections.forEach((ins) => {
        const dKey = ins.inspected_at?.slice(0, 10);
        if (dKey) inspectionsByDate[dKey] = ins;
      });

      // Susun Dokumen PDF Landscape A4
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header Judul
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('LEMBAR CHECKSHEET PEMERIKSAAN HYDRANT BOX', 148, 14, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Periode Bulan: ${monthLabel(pdfBulan)}`, 148, 19, { align: 'center' });

      // Kotak Identitas Hydrant
      doc.setDrawColor(180, 190, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 23, 269, 14, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`No. Hydrant: ${hydrant.number}`, 18, 29);
      doc.text(`Gudang: Gudang ${hydrant.warehouse_name}`, 78, 29);
      doc.text(`Jenis: ${hydrant.type}`, 138, 29);
      doc.text(`Posisi: ${hydrant.location_type === 'indoor' ? 'Dalam Gudang' : 'Luar Gudang'}`, 208, 29);

      doc.setFont('helvetica', 'normal');
      doc.text(`Lokasi: ${hydrant.location_name}`, 18, 34);

      // Data Baris Tabel 31 Hari
      const checklistItems = items ?? [];
      const tableHeaders = [
        'Tgl',
        ...checklistItems.map((it) => it.name),
        'Catatan Kendala / Kondisi',
        'Paraf Petugas',
      ];

      const tableRows = days.map((dayStr) => {
        const ins = inspectionsByDate[dayStr];
        const dayNum = dayStr.slice(8);
        const resMap = new Map((ins?.results ?? []).map((r: any) => [r.checklistItemId, r.result]));

        const rowValues = [dayNum];
        checklistItems.forEach((it) => {
          const res = resMap.get(it.id);
          if (res === 'baik') rowValues.push('✓ Baik');
          else if (res === 'tidak_baik') rowValues.push('✕ Rusak');
          else rowValues.push('-');
        });

        rowValues.push(ins?.notes || (ins ? 'Nihil' : '-'));

        const inspectorName = profiles.find((p) => p.id === ins?.user_id)?.name || (ins ? 'Petugas' : '-');
        rowValues.push(ins ? `${inspectorName} (✓)` : '-');
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

      // Unduh File
      doc.save(`Checksheet-${hydrant.number}-${hydrant.warehouse_name}-${pdfBulan}.pdf`);
      setSuccessMsg(`Laporan PDF untuk ${hydrant.number} berhasil diunduh!`);
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat laporan PDF: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ================= EXPORT EXCEL =================
  const handleExportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingExcel(true);
    setSuccessMsg(null);

    try {
      const targetHydrants =
        excelWarehouseId === 'all'
          ? hydrants
          : hydrants.filter((h) => h.warehouse_id === excelWarehouseId);

      const monthPrefix = excelBulan; // YYYY-MM
      const targetHydrantIds = new Set(targetHydrants.map((h) => h.id));
      const targetInspections = inspections.filter(
        (ins) => targetHydrantIds.has(ins.hydrant_id) && (ins.inspected_at || '').startsWith(monthPrefix)
      );

      // Buat Workbook Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cek Hidran K3';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Rekapitulasi Pemeriksaan');

      // Header Judul
      sheet.mergeCells('A1:H1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'REKAPITULASI PEMERIKSAAN HYDRANT & EQUIPMENT K3';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0E7C86' } };
      titleCell.alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:H2');
      const subCell = sheet.getCell('A2');
      const whLabel =
        excelWarehouseId === 'all'
          ? 'Semua Gudang (WH2, WH3, WH4)'
          : `Gudang ${warehouses.find((w) => w.id === excelWarehouseId)?.name || ''}`;
      subCell.value = `Periode: ${monthLabel(excelBulan)} · Lokasi: ${whLabel}`;
      subCell.font = { name: 'Arial', size: 10, italic: true };
      subCell.alignment = { horizontal: 'center' };

      sheet.addRow([]);

      // Kolom Tabel Header
      const headerRow = sheet.addRow([
        'Waktu Periksa',
        'Gudang',
        'No. Hydrant',
        'Lokasi Penempatan',
        'Petugas Pemeriksa',
        'Catatan Kendala',
        ...items.map((it) => it.name),
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

      // Isi Baris Data
      targetInspections.forEach((ins) => {
        const hyd = hydrants.find((h) => h.id === ins.hydrant_id);
        const resMap = new Map((ins.results ?? []).map((r: any) => [r.checklistItemId, r.result]));
        const inspectorName = profiles.find((p) => p.id === ins.user_id)?.name || 'Petugas';

        const row = sheet.addRow([
          ins.inspected_at ? new Date(ins.inspected_at).toLocaleString('id-ID') : '-',
          hyd ? `Gudang ${hyd.warehouse_name}` : '-',
          hyd?.number || ins.qr_code || '-',
          hyd?.location_name || '-',
          inspectorName,
          ins.notes || '-',
          ...items.map((it) => {
            const val = resMap.get(it.id);
            if (val === 'baik') return 'Baik (✓)';
            if (val === 'tidak_baik') return 'Rusak (✕)';
            return '-';
          }),
        ]);

        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      // Auto-fit kolom
      sheet.columns.forEach((col) => {
        let maxLen = 12;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const l = cell.value ? String(cell.value).length : 0;
          if (l > maxLen) maxLen = Math.min(l, 40);
        });
        col.width = maxLen + 2;
      });

      // Generate Buffer dan Trigger Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap-Checksheet-Hydrant-${excelWarehouseId}-${excelBulan}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccessMsg('Rekapitulasi Excel berhasil diunduh!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat file Excel: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat opsi dan data laporan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ekspor Laporan Checksheet</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Unduh laporan checksheet pemeriksaan format resmi PDF (format lembar fisik) atau format Excel untuk rekapitulasi data K3
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KARTU 1: EKSPOR PDF */}
        <Card title="Ekspor PDF Checksheet (Format Lembar Fisik K3)">
          <form onSubmit={handleExportPdf} className="space-y-4">
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Filter Gudang</label>
              <select
                value={pdfWarehouseFilter}
                onChange={(e) => setPdfWarehouseFilter(e.target.value)}
                className="input text-xs"
              >
                <option value="all">Semua Gudang</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    Gudang {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Pilih Titik Hydrant</label>
              <select
                value={pdfHydrantId}
                onChange={(e) => setPdfHydrantId(e.target.value)}
                required
                className="input text-xs font-medium"
              >
                {filteredPdfHydrants.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.number} - {h.location_name} (Gudang {h.warehouse_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Periode Bulan</label>
              <input
                type="month"
                value={pdfBulan}
                onChange={(e) => setPdfBulan(e.target.value)}
                required
                className="input text-xs font-medium"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Format menyerupai lembar "Checksheet Hydrant" asli: tabel matriks 31 hari, 4 kolom equipment checklist, paraf verifikasi, dan catatan inspeksi.
            </p>

            <button
              type="submit"
              disabled={generatingPdf}
              className="btn-primary min-h-[42px] text-xs w-full flex items-center justify-center gap-2"
            >
              {generatingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyiapkan PDF…
                </>
              ) : (
                <>
                  <FileText size={16} /> Unduh Laporan PDF
                </>
              )}
            </button>
          </form>
        </Card>

        {/* KARTU 2: EKSPOR EXCEL */}
        <Card title="Ekspor Excel Rekapitulasi Checksheet">
          <form onSubmit={handleExportExcel} className="space-y-4">
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Pilih Cakupan Gudang</label>
              <select
                value={excelWarehouseId}
                onChange={(e) => setExcelWarehouseId(e.target.value)}
                className="input text-xs"
              >
                <option value="all">Semua Gudang (WH2, WH3, WH4)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    Gudang {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Periode Bulan</label>
              <input
                type="month"
                value={excelBulan}
                onChange={(e) => setExcelBulan(e.target.value)}
                required
                className="input text-xs font-medium"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              Menghasilkan berkas spreadsheet (.xlsx) rekapitulasi seluruh pemeriksaan lengkap dengan tanggal periksa, kondisi item equipment, nama pemeriksa, dan catatan temuan.
            </p>

            <div className="pt-8">
              <button
                type="submit"
                disabled={generatingExcel}
                className="btn-secondary min-h-[42px] text-xs w-full flex items-center justify-center gap-2 font-bold hover:bg-slate-200"
              >
                {generatingExcel ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Menyiapkan Excel…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={16} className="text-emerald-700" /> Unduh Rekap Excel (.xlsx)
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
