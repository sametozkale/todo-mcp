"use client";

import { isReservedListSlug } from "@/lib/reserved-list-slugs";

export type NoteStoreRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  note_list_id: string | null;
  parent_id?: string | null;
  sub_note_completed_count?: number;
  sub_note_total_count?: number;
  created_at?: string;
};

type CacheEntry = {
  notes: NoteStoreRow[];
  fetchedAt: number;
};

const PREFETCH_TTL_MS = 45_000;
const notesCache = new Map<string, CacheEntry>();

export function getCachedNotes(pathname: string): NoteStoreRow[] | null {
  const hit = notesCache.get(pathname);
  return hit?.notes ?? null;
}

export function setCachedNotes(pathname: string, notes: NoteStoreRow[]): void {
  notesCache.set(pathname, { notes, fetchedAt: Date.now() });
}

async function fetchNotesForPath(pathname: string): Promise<NoteStoreRow[] | null> {
  let url: string | null = null;

  if (pathname === "/notes/all") {
    url = "/api/notes?view=all";
  } else if (/^\/notes\/[^/]+$/.test(pathname)) {
    const slug = pathname.slice("/notes/".length);
    if (!isReservedListSlug(slug)) {
      url = `/api/note-lists/${encodeURIComponent(slug)}/notes`;
    }
  }

  if (!url) return null;

  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return null;
  const json = (await res.json()) as { notes?: NoteStoreRow[] };
  return Array.isArray(json.notes) ? json.notes : null;
}

export async function prefetchNotesForPath(pathname: string): Promise<void> {
  const hit = notesCache.get(pathname);
  if (hit && Date.now() - hit.fetchedAt < PREFETCH_TTL_MS) return;
  try {
    const notes = await fetchNotesForPath(pathname);
    if (notes) setCachedNotes(pathname, notes);
  } catch {
    // Silent prefetch failure.
  }
}

export async function revalidateNotesForPath(pathname: string): Promise<NoteStoreRow[] | null> {
  try {
    const notes = await fetchNotesForPath(pathname);
    if (notes) {
      setCachedNotes(pathname, notes);
      return notes;
    }
  } catch {
    // Ignore transient failures.
  }
  return null;
}
