import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { qrUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const hydrantId = searchParams.get('hydrantId');

    const supabase = await createClient();

    let query = supabase
      .from('hydrants')
      .select('id, number, type, location_name, location_type, qr_code, warehouses(name)')
      .eq('active', true)
      .order('warehouse_id')
      .order('number');

    if (hydrantId) {
      query = query.eq('id', hydrantId);
    }

    const { data: hydrants, error } = await query;
    if (error || !hydrants || hydrants.length === 0) {
      return NextResponse.json({ error: 'Data hydrant tidak ditemukan' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Buat dokumen PDF ukuran A4 (210 x 297 mm)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Grid 2 kolom x 3 baris = 6 kartu QR per halaman A4
    const cols = 2;
    const rows = 3;
    const itemsPerPage = cols * rows;

    const cardWidth = 90;
    const cardHeight = 85;
    const marginX = 12;
    const marginY = 15;
    const gapX = 6;
    const gapY = 6;

    for (let i = 0; i < hydrants.length; i++) {
      const h = hydrants[i] as any;
      const pageIndex = Math.floor(i / itemsPerPage);
      const indexInPage = i % itemsPerPage;

      if (i > 0 && indexInPage === 0) {
        doc.addPage();
      }

      const col = indexInPage % cols;
      const row = Math.floor(indexInPage / cols);

      const x = marginX + col * (cardWidth + gapX);
      const y = marginY + row * (cardHeight + gapY);

      // Bingkai Kartu Label QR
      doc.setDrawColor(14, 124, 134); // Teal
      doc.setLineWidth(0.8);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3);

      // Header Kartu
      doc.setFillColor(14, 124, 134);
      doc.rect(x, y, cardWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CEK HIDRAN · LABEL QR RESMI', x + cardWidth / 2, y + 8, { align: 'center' });

      // Generate Data URL Gambar QR
      const targetUrl = qrUrl(appUrl, h.qr_code);
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        margin: 1,
        width: 256,
        color: { dark: '#0E7C86', light: '#FFFFFF' },
      });

      // Tempatkan Gambar QR
      const qrSize = 40;
      const qrX = x + (cardWidth - qrSize) / 2;
      const qrY = y + 16;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // Detail Teks Titik Hydrant
      doc.setTextColor(38, 50, 56);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${h.number} (Gudang ${h.warehouses?.name})`, x + cardWidth / 2, y + 62, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Tipe: ${h.type} | Posisi: ${h.location_type === 'indoor' ? 'Dalam Gudang' : 'Luar Gudang'}`, x + cardWidth / 2, y + 67, {
        align: 'center',
      });

      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const locText = doc.splitTextToSize(`Lokasi: ${h.location_name}`, cardWidth - 8);
      doc.text(locText, x + cardWidth / 2, y + 72, { align: 'center' });

      // Petunjuk scan di footer kartu
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Pindai dengan aplikasi "Cek Hidran" sebelum inspeksi', x + cardWidth / 2, y + 81, {
        align: 'center',
      });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Label_QR_Hydrant_${hydrantId ? 'Titik' : 'Semua'}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Gagal membuat berkas PDF' }, { status: 500 });
  }
}
