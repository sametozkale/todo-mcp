"use client";

import { createContext, useContext, type ReactNode } from "react";

export type UserNoteListRow = {
  id: string;
  title: string;
  slug: string;
  position: number;
};

export type NoteListTabCounts = {
  all: number;
  byListId: Record<string, number>;
};

type NoteListsShellValue = {
  lists: UserNoteListRow[];
  counts: NoteListTabCounts;
};

const NoteListsShellContext = createContext<NoteListsShellValue | null>(null);

export function NoteListsProvider({
  lists,
  counts,
  children,
}: {
  lists: UserNoteListRow[];
  counts: NoteListTabCounts;
  children: ReactNode;
}) {
  return (
    <NoteListsShellContext.Provider value={{ lists, counts }}>{children}</NoteListsShellContext.Provider>
  );
}

export function useNoteListsShell(): NoteListsShellValue {
  const v = useContext(NoteListsShellContext);
  if (!v) {
    throw new Error("useNoteListsShell must be used within NoteListsProvider");
  }
  return v;
}
