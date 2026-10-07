'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PetugasBundle, QueuedInspection } from '@/lib/types';

interface CekHidranDB extends DBSchema {
  queue: { key: string; value: QueuedInspection };
  cache: { key: string; value: PetugasBundle };
}

let dbPromise: Promise<IDBPDatabase<CekHidranDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<CekHidranDB>('cek-hidran', 1, {
      upgrade(d) {
        d.createObjectStore('queue', { keyPath: 'id' });
        d.createObjectStore('cache');
      },
    });
  }
  return dbPromise;
}

export const QUEUE_EVENT = 'cekhidran:queue';
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function enqueue(item: QueuedInspection) {
  await (await db()).put('queue', item);
  notify();
}
export async function listQueue(): Promise<QueuedInspection[]> {
  const all = await (await db()).getAll('queue');
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function getQueued(id: string) {
  return (await db()).get('queue', id);
}
export async function updateQueued(item: QueuedInspection) {
  await (await db()).put('queue', item);
  notify();
}
export async function removeQueued(id: string) {
  await (await db()).delete('queue', id);
  notify();
}

export async function getBundle(): Promise<PetugasBundle | null> {
  return (await (await db()).get('cache', 'bundle')) ?? null;
}
export async function setBundle(b: PetugasBundle) {
  await (await db()).put('cache', b, 'bundle');
}

/** Ambil data terbaru dari server dan simpan untuk mode offline. */
export async function refreshBundle(): Promise<PetugasBundle | null> {
  const res = await fetch('/api/hydrants', { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) return null;
  const b = (await res.json()) as PetugasBundle;
  await setBundle(b);
  return b;
}
