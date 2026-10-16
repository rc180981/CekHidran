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

export interface ReinspectionRequest {
  id: string;
  hydrant_id: string;
  hydrant_number?: string;
  warehouse_name?: string;
  period_key: string;
  status: 'pending' | 'completed' | 'cancelled';
  requested_by_id: string;
  requested_by_name: string;
  requested_by_role?: string;
  requested_at: string;
  reason: string;
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
}

export interface PetugasBundle {
  user: { id: string; name: string; role: Role; warehouseIds: string[]; warehouseNames?: string[] };
  hydrants: CachedHydrant[];
  items: ChecklistItem[];
  frequency: Frequency;
  fetchedAt: string;
  reinspections?: Record<string, ReinspectionRequest>;
  recentInspections?: Record<string, { inspectedAt: string; inspectorName: string }>;
}

export interface QueuedInspection {
  id: string;
  userId: string;
  userName?: string;
  hydrantId: string;
  hydrantLabel: string;
  qrCode: string;
  inspectedAt: string;
  notes: string;
  results: {
    checklistItemId: string;
    result: CheckResultValue;
    notes?: string;
    photo?: { blob: Blob; takenAt: string };
  }[];
  photos: { blob: Blob; takenAt: string }[];
  signature: Blob;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  /** true bila server menolak permanen (4xx) — perlu tindakan pengguna */
  rejected?: boolean;
}
