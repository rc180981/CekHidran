'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { Image as ImageIcon, Building2, Filter, X, ChevronRight, Eye, FileText, Loader2, Download, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthRange, monthLabel, jakartaMonth } from '@/lib/period';

const MONTHS_LIST = [
  { num: '01', name: 'Januari' },
  { num: '02', name: 'Februari' },
  { num: '03', name: 'Maret' },
  { num: '04', name: 'April' },
  { num: '05', name: 'Mei' },
  { num: '06', name: 'Juni' },
  { num: '07', name: 'Juli' },
  { num: '08', name: 'Agustus' },
  { num: '09', name: 'September' },
  { num: '10', name: 'Oktober' },
  { num: '11', name: 'November' },
  { num: '12', name: 'Desember' },
];

export default function RiwayatChecksheetPage() {
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<'harian' | 'bulanan'>('harian');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Filter States
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedHydrantId, setSelectedHydrantId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<string>(jakartaMonth());
  const [currentYear, setCurrentYear] = useState<string>(new Date().getFullYear().toString());

  // Modal Foto Preview
  const [previewPhotos, setPreviewPhotos] = useState<{ photos: string[]; title: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wSnap, hSnap, iSnap, insSnap, pSnap, freqSnap] = await Promise.all([
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'hydrants')),
          getDocs(collection(db, 'checklist_items')),
          getDocs(collection(db, 'inspections')),
          getDocs(collection(db, 'profiles')),
          getDoc(doc(db, 'app_settings', 'inspection_frequency')),
        ]);

        if (freqSnap.exists() && freqSnap.data()?.value === 'bulanan') {
          setFrequency('bulanan');
        } else {
          setFrequency('harian');
        }

        const wList: any[] = [];
        wSnap.forEach((d) => wList.push(d.data()));
        wList.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(wList);

        const hList: any[] = [];
        hSnap.forEach((d) => hList.push(d.data()));
        hList.sort((a, b) => a.number.localeCompare(b.number));
        setHydrants(hList);
        if (hList.length > 0 && !selectedHydrantId) {
          setSelectedHydrantId(hList[0].id);
        }

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter Hydrant berdasarkan Gudang terpilih
  const filteredHydrants =
    selectedWarehouseId === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === selectedWarehouseId);

  // Jika hydrant yang sedang aktif tidak ada di gudang yang dipilih, alihkan ke hydrant pertama gudang tersebut
  useEffect(() => {
    if (filteredHydrants.length > 0) {
      const exists = filteredHydrants.some((h) => h.id === selectedHydrantId);
      if (!exists) {
        setSelectedHydrantId(filteredHydrants[0].id);
      }
    }
  }, [selectedWarehouseId, filteredHydrants, selectedHydrantId]);

  const activeHydrant = hydrants.find((h) => h.id === selectedHydrantId) || filteredHydrants[0];
  const { days } = monthRange(currentMonth);

  const inspectionsByDate: Record<string, any> = {};
  const inspectionsByMonth: Record<string, any> = {};
  inspections
    .filter((ins) => ins.hydrant_id === activeHydrant?.id)
    .forEach((ins) => {
      const d = ins.inspected_at?.slice(0, 10);
      if (d) inspectionsByDate[d] = ins;

      const mKey = ins.inspected_at?.slice(0, 7);
      if (mKey) {
        if (!inspectionsByMonth[mKey] || ins.inspected_at > inspectionsByMonth[mKey].inspected_at) {
          inspectionsByMonth[mKey] = ins;
        }
      }
    });

  // Handler Cetak PDF Checksheet (Tepat 1 Halaman A4 Landscape)
  const handleExportPdf = () => {
    if (!activeHydrant) return;
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const isMonthly = frequency === 'bulanan';

      // 1. Header Judul & Kop Dokumen Resmi
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('CEK HIDRAN · DEPARTEMEN K3 & HSE', 10, 7.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(isMonthly ? 'FORM K3: FM-HSE-HYD-M01' : 'FORM K3: FM-HSE-HYD-01', 287, 7.5, { align: 'right' });

      // Judul Utama Dokumen
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        isMonthly
          ? 'LEMBAR PEMERIKSAAN HYDRANT BOX BULANAN (TAHUNAN)'
          : 'LEMBAR PEMERIKSAAN HYDRANT BOX',
        148.5,
        11.5,
        { align: 'center' }
      );

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
      doc.text(String(activeHydrant.number || '-').toUpperCase(), 48, 18.5);

      // Baris 2: Lokasi Penempatan (BOLD)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('LOKASI PENEMPATAN', 13, 22.5);
      doc.text(':', 45, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const locText = String(activeHydrant.location_name || '-').toUpperCase();
      doc.text(locText.length > 44 ? locText.slice(0, 42) + '…' : locText, 48, 22.5);

      // --- Kolom 2 (Tengah: Gudang & Tipe Box) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('AREA GUDANG', 109, 18.5);
      doc.text(':', 138, 18.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`GUDANG ${String(activeHydrant.warehouse_name || '-').toUpperCase()}`, 141, 18.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('JENIS PERALATAN', 109, 22.5);
      doc.text(':', 138, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text(String(activeHydrant.type || 'BOX HYDRANT').toUpperCase(), 141, 22.5);

      // --- Kolom 3 (Kanan: Posisi & Periode) ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('ZONA POSISI', 200, 18.5);
      doc.text(':', 227, 18.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(
        activeHydrant.location_type === 'indoor' ? 'INDOOR (DALAM)' : 'OUTDOOR (LUAR)',
        230,
        18.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(isMonthly ? 'PERIODE TAHUN' : 'PERIODE BULAN', 200, 22.5);
      doc.text(':', 227, 22.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(16, 120, 60);
      doc.text(
        isMonthly ? `TAHUN ${currentYear}` : String(monthLabel(currentMonth)).toUpperCase(),
        230,
        22.5
      );

      // 3. Data Baris Tabel
      const checklistItems = items ?? [];

      if (isMonthly) {
        // MODE BULANAN: 12 Baris (Januari s/d Desember)
        const tableHeaders = [
          'NO',
          'BULAN',
          'TGL CEK',
          ...checklistItems.map((it) => it.name.toUpperCase()),
          'CATATAN KENDALA / KONDISI FISIK',
          'PETUGAS PEMERIKSA',
        ];

        const colNoWidth = 8;
        const colBulanWidth = 24;
        const colTglWidth = 18;
        const colCatatanWidth = 56;
        const colPetugasWidth = 36;
        const remainingWidth = 277 - colNoWidth - colBulanWidth - colTglWidth - colCatatanWidth - colPetugasWidth; // 135 mm
        const itemColWidth = checklistItems.length > 0 ? remainingWidth / checklistItems.length : 33.75;

        const columnStylesConfig: Record<number, any> = {
          0: { cellWidth: colNoWidth, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: colBulanWidth, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: colTglWidth, halign: 'center' },
          [tableHeaders.length - 2]: { cellWidth: colCatatanWidth, halign: 'left', overflow: 'ellipsize' },
          [tableHeaders.length - 1]: { cellWidth: colPetugasWidth, halign: 'center', overflow: 'ellipsize' },
        };

        checklistItems.forEach((_, idx) => {
          columnStylesConfig[idx + 3] = { cellWidth: itemColWidth, halign: 'center' };
        });

        const tableRows = MONTHS_LIST.map((m, idx) => {
          const monthKey = `${currentYear}-${m.num}`;
          const ins = inspectionsByMonth[monthKey];
          const tglCek = ins?.inspected_at
            ? new Date(ins.inspected_at).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })
            : '-';
          const resMap = new Map((ins?.results ?? []).map((r: any) => [r.checklistItemId, r.result]));

          const rowValues = [String(idx + 1), m.name, tglCek];
          checklistItems.forEach((it) => {
            const res = resMap.get(it.id);
            if (res === 'baik') rowValues.push('✓ Baik');
            else if (res === 'tidak_baik') rowValues.push('✕ Rusak');
            else rowValues.push('-');
          });

          const noteText = ins?.notes || (ins ? 'Nihil' : '-');
          rowValues.push(noteText.length > 45 ? noteText.slice(0, 42) + '…' : noteText);

          const inspector = profiles.find((p) => p.id === ins?.user_id)?.name || (ins ? 'Petugas' : '-');
          rowValues.push(ins ? `${inspector}` : '-');
          return rowValues;
        });

        autoTable(doc, {
          head: [tableHeaders],
          body: tableRows,
          startY: 25.5,
          theme: 'grid',
          pageBreak: 'avoid',
          rowPageBreak: 'avoid',
          styles: {
            fontSize: 7,
            cellPadding: 1.1,
            minCellHeight: 5.6,
            halign: 'center',
            valign: 'middle',
            textColor: [30, 41, 59],
            lineColor: [203, 213, 225],
            lineWidth: 0.1,
            overflow: 'ellipsize',
          },
          headStyles: {
            fontSize: 7.2,
            cellPadding: 1.2,
            minCellHeight: 5,
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
      } else {
        // MODE HARIAN: 31 Hari Lengkap
        const tableHeaders = [
          'TGL',
          ...checklistItems.map((it) => it.name.toUpperCase()),
          'CATATAN KENDALA / KONDISI',
          'PETUGAS PEMERIKSA',
        ];

        const colTglWidth = 9;
        const colCatatanWidth = 56;
        const colPetugasWidth = 36;
        const remainingWidth = 277 - colTglWidth - colCatatanWidth - colPetugasWidth;
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

          const inspector = profiles.find((p) => p.id === ins?.user_id)?.name || (ins ? 'Petugas' : '-');
          rowValues.push(ins ? `${inspector}` : '-');
          return rowValues;
        });

        autoTable(doc, {
          head: [tableHeaders],
          body: tableRows,
          startY: 25.5,
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
      }

      // 4. Footer & Tanda Tangan Kompak di 1 Halaman yang sama
      const finalY = (doc as any).lastAutoTable?.finalY || 135;
      const footY = finalY + 4;

      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.text(
        isMonthly ? 'KETENTUAN INSPEKSI BULANAN K3 & HSE:' : 'KETENTUAN INSPEKSI K3 & HSE:',
        10,
        footY + 3
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(
        isMonthly
          ? '1. Setiap titik hydrant box wajib diperiksa rutin minimal 1 kali per bulan kalender.'
          : '1. Pemeriksaan fisik hydrant box wajib dilaksanakan rutin setiap hari kerja.',
        10,
        footY + 6.5
      );
      doc.text(
        '2. Segera laporkan ke tim K3 jika ditemukan kendala, segel rusak, atau tekanan abnormal.',
        10,
        footY + 10
      );
      doc.text(
        `Dicetak digital melalui Sistem CEK HIDRAN: ${new Date().toLocaleString('id-ID')}`,
        10,
        footY + 14
      );

      // Kolom Tengah: Petugas Pelaksana
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Petugas Pelaksana / Inspector,', 170, footY + 3, { align: 'center' });
      doc.text('( .................................................. )', 170, footY + 16, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.text(`Regu Gudang ${activeHydrant.warehouse_name}`, 170, footY + 19.5, { align: 'center' });

      // Kolom Kanan: Supervisor K3 / HSE
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

      const fileName = isMonthly
        ? `Checksheet-${activeHydrant.number}-${currentYear}-Tahunan.pdf`
        : `Checksheet-${activeHydrant.number}-${currentMonth}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat file PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat riwayat checksheet…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">RIWAYAT CHECKSHEET HYDRANT</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 uppercase font-semibold">
          {frequency === 'bulanan'
            ? 'FORMAT LEMBAR FISIK RESMI PEMERIKSAAN PER TITIK HYDRANT DAN TABEL MATRIKS 12 BULAN (TAHUNAN)'
            : 'FORMAT LEMBAR FISIK RESMI PEMERIKSAAN PER TITIK HYDRANT DAN TABEL MATRIKS 31 HARI'}
        </p>
      </div>

      {/* FILTER BAR DENGAN PENYARING GUDANG */}
      <Card className="p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Filter 1: Pilih Gudang */}
          <div className="md:col-span-4">
            <label className="label text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Building2 size={15} className="text-primary" /> Filter Gudang
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="input text-xs font-medium"
            >
              <option value="all">Semua Gudang (WH2, WH3, WH4)</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  Gudang {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Pilih Titik Hydrant */}
          <div className="md:col-span-5">
            <label className="label text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Filter size={15} className="text-primary" /> Pilih Titik Hydrant ({filteredHydrants.length} Titik)
            </label>
            <select
              value={selectedHydrantId}
              onChange={(e) => setSelectedHydrantId(e.target.value)}
              className="input text-xs font-medium"
            >
              {filteredHydrants.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.number} - {h.location_name} (Gudang {h.warehouse_name})
                </option>
              ))}
              {filteredHydrants.length === 0 && (
                <option disabled value="">Tidak ada titik di gudang ini</option>
              )}
            </select>
          </div>

          {/* Filter 3: Periode Bulan (Harian) atau Periode Tahun (Bulanan) */}
          <div className="md:col-span-3">
            <label className="label text-xs font-bold text-slate-700 mb-1.5 block">
              {frequency === 'bulanan' ? 'Periode Tahun' : 'Periode Bulan'}
            </label>
            {frequency === 'bulanan' ? (
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                className="input text-xs font-semibold"
              >
                {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="input text-xs font-medium"
              />
            )}
          </div>
        </div>
      </Card>

      {/* LEMBAR CHECKSHEET FISIK */}
      {activeHydrant ? (
        <div className="card bg-white p-6 sheet shadow-md overflow-x-auto space-y-6 border border-slate-300">
          <div className="border border-slate-400 p-4 rounded-xl bg-slate-50/60 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-300 pb-2 mb-3 gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                  CEK HIDRAN · DEPARTEMEN K3 & HSE
                </span>
                <div className="font-extrabold text-base sm:text-lg text-slate-900 uppercase tracking-wider">
                  {frequency === 'bulanan'
                    ? 'LEMBAR PEMERIKSAAN HYDRANT BOX BULANAN (TAHUNAN)'
                    : 'LEMBAR PEMERIKSAAN HYDRANT BOX'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="btn-primary text-xs px-3.5 py-1.5 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {exportingPdf ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Menyiapkan PDF...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Ekspor PDF Checksheet
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-800">
              <div>
                <span className="text-slate-500 font-medium">NO. TITIK HYDRANT:</span>{' '}
                <strong className="text-sm font-bold text-slate-900">{activeHydrant.number}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">AREA GUDANG:</span>{' '}
                <strong className="font-bold text-slate-900">Gudang {activeHydrant.warehouse_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">JENIS PERALATAN:</span>{' '}
                <strong className="font-bold text-slate-900 uppercase">{activeHydrant.type}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 font-medium">LOKASI PENEMPATAN:</span>{' '}
                <strong className="font-bold text-slate-950 uppercase">{activeHydrant.location_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">
                  {frequency === 'bulanan' ? 'PERIODE TAHUN:' : 'PERIODE BULAN:'}
                </span>{' '}
                <strong className="text-primary font-bold uppercase">
                  {frequency === 'bulanan' ? `TAHUN ${currentYear}` : monthLabel(currentMonth)}
                </strong>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-400 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-center font-bold">
                  {frequency === 'bulanan' ? (
                    <>
                      <th className="p-2 border border-slate-400 w-12">NO</th>
                      <th className="p-2 border border-slate-400 min-w-[90px]">BULAN</th>
                      <th className="p-2 border border-slate-400 min-w-[80px]">TGL CEK</th>
                    </>
                  ) : (
                    <th className="p-2 border border-slate-400 w-16">TGL</th>
                  )}
                  {items.map((it) => (
                    <th key={it.id} className="p-2 border border-slate-400 min-w-[120px] uppercase">
                      {it.name}
                    </th>
                  ))}
                  <th className="p-2 border border-slate-400 min-w-[140px] uppercase">CATATAN / KETERANGAN KONDISI FISIK</th>
                  <th className="p-2 border border-slate-400 w-24 uppercase">FOTO KONDISI</th>
                  <th className="p-2 border border-slate-400 w-24 uppercase">PETUGAS PEMERIKSA</th>
                </tr>
              </thead>
              <tbody>
                {frequency === 'bulanan' ? (
                  /* TAMPILAN MATRIKS 12 BULAN (TAHUNAN) */
                  MONTHS_LIST.map((m, idx) => {
                    const monthKey = `${currentYear}-${m.num}`;
                    const ins = inspectionsByMonth[monthKey];
                    const tglCek = ins?.inspected_at
                      ? new Date(ins.inspected_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '-';
                    const resultMap = new Map(
                      (ins?.results ?? []).map((r: any) => [r.checklistItemId, r.result])
                    );
                    const isCurrentMonth = jakartaMonth() === monthKey;

                    return (
                      <tr
                        key={m.num}
                        className={`hover:bg-slate-50/80 ${
                          isCurrentMonth
                            ? 'bg-teal-50/50 font-medium'
                            : ins
                            ? 'bg-white'
                            : 'bg-slate-50/30 text-slate-400'
                        }`}
                      >
                        <td className="p-2 border border-slate-400 text-center font-bold text-slate-700">
                          {idx + 1}
                        </td>

                        <td className="p-2 border border-slate-400 text-center font-bold text-slate-800">
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{m.name}</span>
                            {isCurrentMonth && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse"
                                title="Bulan Berjalan"
                              />
                            )}
                          </div>
                        </td>

                        <td className="p-2 border border-slate-400 text-center font-mono text-[11px] font-semibold text-slate-700">
                          {tglCek}
                        </td>

                        {items.map((it) => {
                          const res = resultMap.get(it.id);
                          return (
                            <td key={it.id} className="p-2 border border-slate-400 text-center font-medium">
                              {res === 'baik' && (
                                <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                                  ✓ Baik
                                </span>
                              )}
                              {res === 'tidak_baik' && (
                                <span className="text-red-700 font-bold inline-flex items-center gap-0.5">
                                  ✕ Rusak
                                </span>
                              )}
                              {!res && <span className="text-slate-300">-</span>}
                            </td>
                          );
                        })}

                        <td className="p-2 border border-slate-400 text-slate-700 text-xs">
                          {ins?.notes || (ins ? <span className="text-slate-400 italic">Nihil</span> : '-')}
                        </td>

                        <td className="p-2 border border-slate-400 text-center">
                          {ins?.photos && ins.photos.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhotos({
                                  photos: ins.photos,
                                  title: `Foto Pemeriksaan ${activeHydrant.number} (${m.name} ${currentYear})`,
                                })
                              }
                              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs py-0.5 px-2 rounded bg-primary-50"
                            >
                              <ImageIcon size={13} /> {ins.photos.length} Foto
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-2 border border-slate-400 text-center">
                          {ins ? (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-900 block text-xs">
                                {profiles.find((p) => p.id === ins?.user_id)?.name || 'Petugas'}
                              </span>
                              {ins.signature_url ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewPhotos({
                                      photos: [ins.signature_url],
                                      title: `Tanda Tangan Petugas (${m.name} ${currentYear})`,
                                    })
                                  }
                                  className="text-emerald-700 font-semibold text-[10px] hover:underline block mx-auto"
                                >
                                  Paraf ✓
                                </button>
                              ) : (
                                <span className="text-emerald-700 font-semibold text-[10px] block">Paraf ✓</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  /* TAMPILAN MATRIKS 31 HARI (HARIAN) */
                  days.map((dayStr) => {
                    const ins = inspectionsByDate[dayStr];
                    const dayNum = dayStr.slice(8);
                    const resultMap = new Map(
                      (ins?.results ?? []).map((r: any) => [r.checklistItemId, r.result])
                    );

                    return (
                      <tr key={dayStr} className={`hover:bg-slate-50/80 ${ins ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="p-2 border border-slate-400 text-center font-bold text-slate-700">
                          {dayNum}
                        </td>

                        {items.map((it) => {
                          const res = resultMap.get(it.id);
                          return (
                            <td key={it.id} className="p-2 border border-slate-400 text-center font-medium">
                              {res === 'baik' && (
                                <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                                  ✓ Baik
                                </span>
                              )}
                              {res === 'tidak_baik' && (
                                <span className="text-red-700 font-bold inline-flex items-center gap-0.5">
                                  ✕ Rusak
                                </span>
                              )}
                              {!res && <span className="text-slate-300">-</span>}
                            </td>
                          );
                        })}

                        <td className="p-2 border border-slate-400 text-slate-700 text-xs">
                          {ins?.notes || (ins ? <span className="text-slate-400 italic">Nihil</span> : '-')}
                        </td>

                        <td className="p-2 border border-slate-400 text-center">
                          {ins?.photos && ins.photos.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhotos({
                                  photos: ins.photos,
                                  title: `Foto Pemeriksaan ${activeHydrant.number} (${dayStr})`,
                                })
                              }
                              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs py-0.5 px-2 rounded bg-primary-50"
                            >
                              <ImageIcon size={13} /> {ins.photos.length} Foto
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="p-2 border border-slate-400 text-center">
                          {ins?.signature_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewPhotos({
                                  photos: [ins.signature_url],
                                  title: `Tanda Tangan Petugas (${dayStr})`,
                                })
                              }
                              className="text-emerald-700 font-semibold text-[11px] hover:underline"
                            >
                              Paraf ✓
                            </button>
                          ) : ins ? (
                            <span className="text-emerald-700 font-semibold text-[11px]">Paraf ✓</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Card className="p-10 text-center text-slate-500">
          <p className="font-semibold">Tidak ada titik hydrant yang ditemukan pada gudang terpilih.</p>
        </Card>
      )}

      {/* ================= MODAL LIGHTBOX FOTO PREVIEW ================= */}
      {previewPhotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-sm text-slate-800">{previewPhotos.title}</strong>
              <button
                type="button"
                onClick={() => setPreviewPhotos(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {previewPhotos.photos.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 text-center">
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="max-h-[60vh] mx-auto object-contain"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setPreviewPhotos(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
