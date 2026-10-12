'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { jakartaMonth, monthRange, monthLabel } from '@/lib/period';
import { FileText, FileSpreadsheet, Download, Loader2, Building2, CheckCircle2, QrCode, Tag, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';

export default function EksporLaporanPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  // Form State PDF Checksheet
  const [pdfWarehouseFilter, setPdfWarehouseFilter] = useState<string>('all');
  const [pdfHydrantId, setPdfHydrantId] = useState<string>('');
  const [pdfBulan, setPdfBulan] = useState<string>(jakartaMonth());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Form State Excel Rekapitulasi
  const [excelWarehouseId, setExcelWarehouseId] = useState<string>('all');
  const [excelBulan, setExcelBulan] = useState<string>(jakartaMonth());
  const [generatingExcel, setGeneratingExcel] = useState(false);

  // Form State Stiker QR Code Box Hydrant (Label 10 x 15 cm)
  const [stickerWarehouseFilter, setStickerWarehouseFilter] = useState<string>('all');
  const [stickerHydrantId, setStickerHydrantId] = useState<string>('all');
  const [generatingStickers, setGeneratingStickers] = useState(false);

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

  const filteredStickerHydrants =
    stickerWarehouseFilter === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === stickerWarehouseFilter);

  useEffect(() => {
    if (filteredPdfHydrants.length > 0 && !filteredPdfHydrants.some((h) => h.id === pdfHydrantId)) {
      setPdfHydrantId(filteredPdfHydrants[0].id);
    }
  }, [pdfWarehouseFilter, filteredPdfHydrants, pdfHydrantId]);

  useEffect(() => {
    if (
      stickerHydrantId !== 'all' &&
      filteredStickerHydrants.length > 0 &&
      !filteredStickerHydrants.some((h) => h.id === stickerHydrantId)
    ) {
      setStickerHydrantId('all');
    }
  }, [stickerWarehouseFilter, filteredStickerHydrants, stickerHydrantId]);

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

      // Susun Dokumen PDF Landscape A4 (Single Page Guarantee, 31 Hari Lengkap)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // 1. Header Judul & Kop Dokumen Resmi
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('CEK HIDRAN · DEPARTEMEN K3 & HSE', 10, 7.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FORM K3: FM-HSE-HYD-01', 287, 7.5, { align: 'right' });

      // Judul Utama Dokumen
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(15, 23, 42);
      doc.text('LEMBAR PEMERIKSAAN HYDRANT BOX', 148.5, 11.5, { align: 'center' });

      // Garis Divider Tipis di Bawah Judul
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(10, 13.5, 287, 13.5);

      // 2. Info Box Hydrant Terstruktur 3 Kolom Grid Sejajar
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(10, 15, 277, 10, 1, 1, 'FD');

      // Garis Partisi Vertikal Antar Kolom
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(105, 15, 105, 25);
      doc.line(196, 15, 196, 25);

      // --- Kolom 1 (Kiri: No. Hydrant & Lokasi) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('NO. TITIK HYDRANT', 13, 18.5);
      doc.text(':', 45, 18.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(String(hydrant.number || '-').toUpperCase(), 48, 18.5);

      // Baris 2: Lokasi Penempatan (BOLD)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('LOKASI PENEMPATAN', 13, 22.5);
      doc.text(':', 45, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const locText = String(hydrant.location_name || '-').toUpperCase();
      doc.text(locText.length > 44 ? locText.slice(0, 42) + '…' : locText, 48, 22.5);

      // --- Kolom 2 (Tengah: Gudang & Tipe Box) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('AREA GUDANG', 109, 18.5);
      doc.text(':', 138, 18.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`GUDANG ${String(hydrant.warehouse_name || '-').toUpperCase()}`, 141, 18.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('JENIS PERALATAN', 109, 22.5);
      doc.text(':', 138, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text(String(hydrant.type || 'BOX HYDRANT').toUpperCase(), 141, 22.5);

      // --- Kolom 3 (Kanan: Posisi & Periode Bulan) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('ZONA POSISI', 200, 18.5);
      doc.text(':', 227, 18.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(
        hydrant.location_type === 'indoor' ? 'INDOOR (DALAM)' : 'OUTDOOR (LUAR)',
        230,
        18.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('PERIODE BULAN', 200, 22.5);
      doc.text(':', 227, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(16, 120, 60);
      doc.text(String(monthLabel(pdfBulan)).toUpperCase(), 230, 22.5);

      // 3. Data Baris Tabel 31 Hari
      const checklistItems = items ?? [];
      const tableHeaders = [
        'TGL',
        ...checklistItems.map((it) => it.name.toUpperCase()),
        'CATATAN KENDALA / KONDISI',
        'PETUGAS PEMERIKSA',
      ];

      // Alokasi Lebar Kolom Presisi (Total 277 mm)
      const colTglWidth = 9;
      const colCatatanWidth = 56;
      const colPetugasWidth = 36;
      const remainingWidth = 277 - colTglWidth - colCatatanWidth - colPetugasWidth; // 176 mm
      const itemColWidth = checklistItems.length > 0 ? remainingWidth / checklistItems.length : 30;

      const columnStylesConfig: Record<number, any> = {
        0: { cellWidth: colTglWidth, halign: 'center', fontStyle: 'bold' },
        [tableHeaders.length - 2]: { cellWidth: colCatatanWidth, halign: 'left', overflow: 'ellipsize' },
        [tableHeaders.length - 1]: { cellWidth: colPetugasWidth, halign: 'center', overflow: 'ellipsize' },
      };

      checklistItems.forEach((_, idx) => {
        columnStylesConfig[idx + 1] = { cellWidth: itemColWidth, halign: 'center' };
      });

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

        const noteText = ins?.notes || (ins ? 'Nihil' : '-');
        rowValues.push(noteText.length > 45 ? noteText.slice(0, 42) + '…' : noteText);

        const inspectorName = profiles.find((p) => p.id === ins?.user_id)?.name || (ins ? 'Petugas' : '-');
        rowValues.push(ins ? `${inspectorName}` : '-');
        return rowValues;
      });

      autoTable(doc, {
        startY: 25.5,
        head: [tableHeaders],
        body: tableRows,
        theme: 'grid',
        pageBreak: 'avoid',
        rowPageBreak: 'avoid',
        styles: {
          fontSize: 6.2,
          cellPadding: 0.6,
          minCellHeight: 3.2,
          halign: 'center',
          valign: 'middle',
          textColor: [30, 41, 59],
          lineColor: [203, 213, 225],
          lineWidth: 0.1,
          overflow: 'ellipsize',
        },
        headStyles: {
          fontSize: 6.6,
          cellPadding: 0.8,
          minCellHeight: 4,
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          lineColor: [148, 163, 184],
          lineWidth: 0.15,
        },
        columnStyles: columnStylesConfig,
        didParseCell: (data) => {
          if (data.section === 'body') {
            const val = String(data.cell.raw);
            if (val.includes('✓ Baik')) {
              data.cell.styles.textColor = [16, 120, 60];
              data.cell.styles.fontStyle = 'bold';
            } else if (val.includes('✕ Rusak')) {
              data.cell.styles.textColor = [200, 25, 25];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.column.index === tableHeaders.length - 1 && val !== '-') {
              data.cell.styles.textColor = [15, 23, 42];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 10, right: 10, top: 5, bottom: 5 },
      });

      // 4. Footer & Tanda Tangan Kompak
      const finalY = (doc as any).lastAutoTable?.finalY || 135;
      const footY = finalY + 4;

      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.text('KETENTUAN INSPEKSI K3 & HSE:', 10, footY + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('1. Pemeriksaan fisik hydrant box wajib dilaksanakan rutin setiap hari kerja.', 10, footY + 6.5);
      doc.text('2. Segera laporkan ke tim K3 jika ditemukan kendala, segel rusak, atau tekanan abnormal.', 10, footY + 10);
      doc.text(`Dicetak digital melalui Sistem CEK HIDRAN: ${new Date().toLocaleString('id-ID')}`, 10, footY + 14);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Petugas Pelaksana / Inspector,', 170, footY + 3, { align: 'center' });
      doc.text('( .................................................. )', 170, footY + 16, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.text(`Regu Gudang ${hydrant.warehouse_name}`, 170, footY + 19.5, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Mengetahui / Verifikasi,', 250, footY + 3, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text('Supervisor K3 / HSE Officer', 250, footY + 6.5, { align: 'center' });
      doc.text('( .................................................. )', 250, footY + 16, { align: 'center' });
      doc.setFontSize(6.2);
      doc.text('Tgl Verifikasi: .........................', 250, footY + 19.5, { align: 'center' });

      // Pastikan Halaman Ekstra Terhapus (Single Page Guarantee)
      while (doc.getNumberOfPages() > 1) {
        doc.deletePage(doc.getNumberOfPages());
      }

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
      workbook.creator = 'CEK HIDRAN · K3 & HSE';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Rekapitulasi Pemeriksaan');

      // Header Kop Dokumen
      sheet.mergeCells('A1:H1');
      const kopCell = sheet.getCell('A1');
      kopCell.value = 'CEK HIDRAN · DEPARTEMEN K3 & HSE';
      kopCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } };
      kopCell.alignment = { horizontal: 'center' };

      // Header Judul
      sheet.mergeCells('A2:H2');
      const titleCell = sheet.getCell('A2');
      titleCell.value = 'REKAPITULASI PEMERIKSAAN HYDRANT & EQUIPMENT K3';
      titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0E7C86' } };
      titleCell.alignment = { horizontal: 'center' };

      sheet.mergeCells('A3:H3');
      const subCell = sheet.getCell('A3');
      const whLabel =
        excelWarehouseId === 'all'
          ? 'SEMUA GUDANG (WH2, WH3, WH4)'
          : `GUDANG ${warehouses.find((w) => w.id === excelWarehouseId)?.name || ''}`.toUpperCase();
      subCell.value = `PERIODE: ${monthLabel(excelBulan).toUpperCase()} · LOKASI: ${whLabel}`;
      subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
      subCell.alignment = { horizontal: 'center' };

      sheet.addRow([]);

      // Kolom Tabel Header
      const headerRow = sheet.addRow([
        'WAKTU PERIKSA',
        'GUDANG',
        'NO. TITIK HYDRANT',
        'LOKASI PENEMPATAN',
        'PETUGAS PEMERIKSA',
        'CATATAN KENDALA',
        ...items.map((it) => it.name.toUpperCase()),
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

  // ================= EXPORT STIKER QR CODE BOX HYDRANT (10 x 15 CM) =================
  const handleExportStickersPdf = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetList =
      stickerHydrantId === 'all'
        ? filteredStickerHydrants
        : filteredStickerHydrants.filter((h) => h.id === stickerHydrantId);

    if (targetList.length === 0) {
      alert('Tidak ada titik hydrant yang dipilih untuk dicetak.');
      return;
    }

    setGeneratingStickers(true);
    setSuccessMsg(null);

    try {
      // Ukuran Standar Label Stiker K3: 10 x 15 cm (100 mm x 150 mm Portrait)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150],
      });

      const printDate = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      for (let i = 0; i < targetList.length; i++) {
        if (i > 0) {
          doc.addPage([100, 150], 'portrait');
        }

        const hydrant = targetList[i];

        // 1. Border Ganda K3 Keselamatan
        doc.setDrawColor(220, 38, 38); // Merah K3
        doc.setLineWidth(1.2);
        doc.roundedRect(3.5, 3.5, 93, 143, 3, 3, 'S');

        doc.setDrawColor(226, 232, 240); // Inner line aksen
        doc.setLineWidth(0.3);
        doc.roundedRect(5, 5, 90, 140, 2, 2, 'S');

        // 2. Header K3 & HSE (Merah Solid)
        doc.setFillColor(220, 38, 38);
        doc.roundedRect(5, 5, 90, 17, 2, 2, 'F');
        doc.rect(5, 17, 90, 4, 'F'); // Ratakan sudut bawah header

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('DEPARTEMEN K3 & HSE \u2022 FIRE PROTECTION', 50, 10, { align: 'center' });

        doc.setFontSize(10.5);
        doc.text('STIKER RESMI BOX HYDRANT', 50, 15.5, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('SISTEM TANGGAP DARURAT & PEMERIKSAAN BERKALA', 50, 19.5, { align: 'center' });

        // 3. Card Identitas Box & Gudang
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(7, 24, 86, 23, 2, 2, 'FD');

        // Nomor Box Hydrant Besar
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('NO. HYDRANT', 10, 28.5);

        doc.setFontSize(22);
        doc.setTextColor(220, 38, 38);
        doc.text(hydrant.number || '-', 10, 37.5);

        // Badge Gudang & Tipe
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(42, 26, 48, 6, 1, 1, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `GUDANG ${hydrant.warehouse_name || '-'} [${(hydrant.location_type || 'INDOOR').toUpperCase()}]`,
          66,
          30.2,
          { align: 'center' }
        );

        // Lokasi Spesifik
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(6.8);
        doc.setFont('helvetica', 'normal');
        const locLines = doc.splitTextToSize(`Lokasi: ${hydrant.location_name || '-'}`, 48);
        doc.text(locLines, 42, 36);

        // 4. Area QR Code Hi-Res
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.roundedRect(12, 49, 76, 56, 2, 2, 'FD');

        // Generate QR Code Data URL
        const qrContent = hydrant.qr_code || hydrant.number || `HYDRANT-${hydrant.id}`;
        const qrDataUrl = await QRCode.toDataURL(qrContent, {
          width: 500,
          margin: 1,
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        });

        // Gambar QR Code (Ukuran 42 x 42 mm di tengah)
        doc.addImage(qrDataUrl, 'PNG', 29, 51.5, 42, 42);

        // Teks Kode QR
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(qrContent, 50, 97, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('Pindai via Aplikasi Cek Hidran saat melakukan inspeksi berkala', 50, 101, { align: 'center' });

        // 5. Checklist Acuan Standar Kelengkapan Box K3
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(7, 107, 86, 20.5, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(30, 41, 59);
        doc.text('STANDAR KELENGKAPAN BOX HYDRANT (K3):', 10, 111.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(51, 65, 85);

        // Kolom Kiri
        doc.text('[✓] 1. Pintu Box, Kaca & Kunci Utuh', 10, 116);
        doc.text('[✓] 2. Nozzle & Packing Seal Lengkap', 10, 120.5);
        doc.text('[✓] 3. Selang / Hose Tergulung Rapi', 10, 125);

        // Kolom Kanan
        doc.text('[✓] 4. Keran / Valve Tidak Bocor', 52, 116);
        doc.text('[✓] 5. Tekanan Air Sesuai Standar', 52, 120.5);
        doc.text('[✓] 6. Bebas Hambatan Min 1 Meter', 52, 125);

        // 6. Footer Banner Peringatan K3
        doc.setFillColor(153, 27, 27); // Dark Red
        doc.roundedRect(7, 129.5, 86, 13, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(254, 240, 138); // Yellow alert
        doc.text('\u26A0 PERINGATAN KESELAMATAN K3 \u26A0', 50, 134, { align: 'center' });

        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text('DILARANG MENGHALANGI AKSES BOX HYDRANT!', 50, 138, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.text('Wajib menjaga radius bebas hambatan min. 1 meter di depan box.', 50, 141, { align: 'center' });

        // 7. Catatan Cetak Luar Border
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Format Label 10 x 15 cm \u2022 Sistem K3 Cek Hidran \u2022 Cetak: ${printDate}`, 50, 148, { align: 'center' });
      }

      const fileName =
        targetList.length === 1
          ? `Stiker-QR-Hydrant-${targetList[0].number || 'Box'}-10x15cm.pdf`
          : `Stiker-QR-Hydrant-Keseluruhan-${stickerWarehouseFilter}-${targetList.length}Titik-10x15cm.pdf`;

      doc.save(fileName);
      setSuccessMsg(`Stiker QR Code (${targetList.length} titik) ukuran 10 x 15 cm berhasil diunduh!`);
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat stiker QR Code: ' + (err?.message || 'Error'));
    } finally {
      setGeneratingStickers(false);
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
        <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">EKSPOR LAPORAN CHECKSHEET</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 uppercase font-semibold">
          UNDUH LAPORAN CHECKSHEET PEMERIKSAAN FORMAT RESMI PDF (FORMAT LEMBAR FISIK), EXCEL REKAPITULASI, SERTA STIKER QR CODE BOX HYDRANT (LABEL 10 X 15 CM)
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* KARTU 1: EKSPOR PDF */}
        <Card title="EKSPOR PDF CHECKSHEET (FORMAT LEMBAR FISIK K3)">
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
        <Card title="EKSPOR EXCEL REKAPITULASI CHECKSHEET">
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

        {/* KARTU 3: EKSPOR STIKER QR CODE BOX HYDRANT */}
        <Card title="STIKER QR CODE BOX HYDRANT (LABEL 10 x 15 CM)">
          <form onSubmit={handleExportStickersPdf} className="space-y-4">
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 block">Filter Gudang</label>
              <select
                value={stickerWarehouseFilter}
                onChange={(e) => setStickerWarehouseFilter(e.target.value)}
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
                value={stickerHydrantId}
                onChange={(e) => setStickerHydrantId(e.target.value)}
                className="input text-xs font-medium"
              >
                <option value="all">
                  🌟 Cetak Keseluruhan ({filteredStickerHydrants.length} Titik)
                </option>
                {filteredStickerHydrants.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.number} - {h.location_name} (Gudang {h.warehouse_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Tag size={13} className="shrink-0" /> Standar Label Stiker K3 (10 x 15 cm):
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-950/80">
                <li>Ukuran presisi label stiker: 100 x 150 mm (Thermal / Glossy).</li>
                <li>Identitas resmi K3, No. Box besar, nama gudang & lokasi.</li>
                <li>QR Code resolusi tinggi (Error Correction H) + Teks Kode.</li>
                <li>Panduan 6 acuan kelengkapan box & banner peringatan K3.</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={generatingStickers}
              className="w-full min-h-[42px] text-xs font-bold rounded-xl text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              {generatingStickers ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyiapkan Stiker QR…
                </>
              ) : (
                <>
                  <Printer size={16} /> Unduh Stiker Label (10 x 15 cm)
                </>
              )}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
