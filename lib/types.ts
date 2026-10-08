import type { Role } from './rbac';
import type { Frequency } from './period';

export type CheckResultValue = 'baik' | 'tidak_baik';
export type LocationType = 'indoor' | 'outdoor';
export type FindingStatus = 'terbuka' | 'dalam_perbaikan' | 'selesai';

export interface ChecklistItem {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active?: boolean;
}

/** Data hydrant yang di-cache di perangkat petugas (QR disimpan sebagai hash). */
export interface CachedHydrant {
  id: string;
  number: string;
  type: string;
  location_name: string;
  location_type: LocationType;
  warehouse_id: string;
  warehouse_name: string;
  qr_hash: string;
  qr_code?: string;
}

export interface PetugasBundle {
  user: { id: string; name: string; role: Role; warehouseIds: string[] };
  hydrants: CachedHydrant[];
  items: ChecklistItem[];
  frequency: Frequency;
  fetchedAt: string;
}

export interface QueuedInspection {
  id: string;
  userId: string;
  hydrantId: string;
  hydrantLabel: string;
  qrCode: string;
  inspectedAt: string;
  notes: string;
  results: { checklistItemId: string; result: CheckResultValue }[];
  photos: { blob: Blob; takenAt: string }[];
  signature: Blob;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  /** true bila server menolak permanen (4xx) — perlu tindakan pengguna */
  rejected?: boolean;
}
