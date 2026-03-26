"use client";

import { createContext, useContext, type ReactNode } from "react";

export type UserListRow = {
  id: string;
  title: string;
  slug: string;
  position: number;
};

export type ListTabCounts = {
  /** Total todos for the user (all lists). */
  all: number;
  /** Completed + incomplete todos per list id. */
  byListId: Record<string, number>;
};

type ListsShellValue = {
  lists: UserListRow[];
  counts: ListTabCounts;
};

const ListsShellContext = createContext<ListsShellValue | null>(null);

export function ListsProvider({
  lists,
  counts,
  children,
}: {
  lists: UserListRow[];
  counts: ListTabCounts;
  children: ReactNode;
}) {
  return (
    <ListsShellContext.Provider value={{ lists, counts }}>{children}</ListsShellContext.Provider>
  );
}

export function useListsShell(): ListsShellValue {
  const v = useContext(ListsShellContext);
  if (!v) {
    throw new Error("useListsShell must be used within ListsProvider");
  }
  return v;
}
