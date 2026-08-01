"use client";

import {
  addNoteAction,
  deleteNoteAction,
} from "@/app/(app)/notes/actions";
import {
  createNoteListAction,
  deleteNoteListAction,
  renameNoteListAction,
  reorderNoteListsAction,
  type DeleteNoteListMode,
} from "@/app/(app)/note-lists/actions";
import { useNoteListsShell, type UserNoteListRow } from "@/app/(app)/note-lists-shell";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  ArrowDown01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { Pencil, X } from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Dropdown,
  Input,
  Label,
  Modal,
  TextField,
  useOverlayState,
} from "@heroui/react";
import { toast } from "@/lib/app-toast";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useMemo,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/useSubscription";
import { getCachedNotes, prefetchNotesForPath, setCachedNotes } from "@/hooks/useNotesStore";
import {
  YALP_OPEN_KEYBOARD_SHORTCUTS,
  YALP_OPEN_PROFILE,
  YALP_OPEN_PLANS,
} from "@/lib/yalp-shortcut-events";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import type { CSSProperties, MouseEvent } from "react";
import {
  type NoteOptimisticAction,
  type NoteRow,
  type NoteRowHandlers,
  PresenceNoteRow,
} from "./note-row";

/** Çok satırda toplam cascade süresini ~0,5s içinde tut; sıra değişince aynı id’ye aynı gecikme (ref ile). */
const LIST_ENTRANCE_INDEX_CAP = 40;
const LIST_ENTRANCE_TIME_BUDGET_SEC = 0.52;
const FAST_RENDER_LIMIT = 240;
const FAST_RENDER_STEP = 220;

function computeNoteEntranceDelay(
  visualIndex: number,
  visibleCount: number,
  prefersReducedMotion: boolean | null,
): number {
  if (prefersReducedMotion) return 0;
  const cappedCount = Math.max(1, Math.min(visibleCount, LIST_ENTRANCE_INDEX_CAP));
  const stagger = Math.min(0.038, LIST_ENTRANCE_TIME_BUDGET_SEC / cappedCount);
  return Math.min(visualIndex, LIST_ENTRANCE_INDEX_CAP) * stagger;
}

export type NotesClientProps = {
  initialNotes: NoteRow[];
  /** Reserved for future view-specific behavior (All / custom list). */
  view?: "all" | "list";
  composerNoteListId: string | null;
  /** Passed by pages for future header customization; currently unused in the client shell. */
  sectionHeaderLabel?: string;
};

type SortableListTabChipProps = {
  list: UserNoteListRow;
  displayTitle: string;
  href: string;
  chipClassName: string;
  isActive: boolean;
  count: number;
  onListContextMenu: (list: UserNoteListRow, e: MouseEvent) => void;
  onPrefetch: (href: string) => void;
};

function SortableListTabChip({
  list,
  displayTitle,
  href,
  chipClassName,
  isActive,
  count,
  onListContextMenu,
  onPrefetch,
}: SortableListTabChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="inline-flex"
      onContextMenu={(e) => {
        e.preventDefault();
        onListContextMenu(list, e);
      }}
    >
      <div className="inline-flex touch-none cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <Link
          href={href}
          className={chipClassName}
          aria-current={isActive ? "page" : undefined}
          onMouseEnter={() => onPrefetch(href)}
          onFocus={() => onPrefetch(href)}
        >
          {displayTitle}{" "}
          {isActive ? (
            <>
              <span className="mx-[2px] text-muted/70">•</span> {count}
            </>
          ) : null}
        </Link>
      </div>
    </div>
  );
}

function isTextTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    const t = target.type;
    return (
      t === "text" ||
      t === "search" ||
      t === "email" ||
      t === "password" ||
      t === "url" ||
      t === "tel" ||
      t === "number" ||
      t === ""
    );
  }
  return false;
}

type ContextMenuState = {
  noteListId: string;
  slug: string;
  title: string;
  x: number;
  y: number;
};

function applyNoteOptimistic(state: NoteRow[], action: NoteOptimisticAction): NoteRow[] {
  switch (action.type) {
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "add":
      return [action.note, ...state];
    case "duplicateAfter": {
      const idx = state.findIndex((t) => t.id === action.afterId);
      if (idx < 0) return [...state, action.note];
      return [...state.slice(0, idx + 1), action.note, ...state.slice(idx + 1)];
    }
    case "moveList":
      return state.map((t) => (t.id === action.id ? { ...t, note_list_id: action.note_list_id } : t));
    case "updateTitle":
      return state.map((t) => (t.id === action.id ? { ...t, title: action.title } : t));
  }
}

export function NotesClient({ initialNotes, composerNoteListId, view }: NotesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [listNavGeneration, setListNavGeneration] = useState(0);
  const prevPathnameForNav = useRef(pathname);
  useEffect(() => {
    if (prevPathnameForNav.current !== pathname) {
      prevPathnameForNav.current = pathname;
      setListNavGeneration((n) => n + 1);
    }
  }, [pathname]);
  useEffect(() => {
    const start = performance.now();
    const id = window.requestAnimationFrame(() => {
      const elapsed = performance.now() - start;
      if (process.env.NODE_ENV !== "production" && elapsed > 220) {
        console.warn("[yalp] list-switch paint slower than target:", Math.round(elapsed), "ms", pathname);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);
  /** İlk yüklemede stagger korunur; /all ↔ liste ↔ /today arası geçişte satır girişi anında. */
  const skipListEntranceAnimations = listNavGeneration > 0;
  const prefersReducedMotion = useReducedMotion();
  const routeListKey = `${pathname}::${composerNoteListId ?? ""}`;
  const entranceDelayByIdRef = useRef<Map<string, number>>(new Map());
  const routeListKeyForDelaysRef = useRef(routeListKey);
  if (routeListKeyForDelaysRef.current !== routeListKey) {
    routeListKeyForDelaysRef.current = routeListKey;
    entranceDelayByIdRef.current = new Map();
  }
  const getEntranceDelay = useCallback(
    (id: string, visualIndex: number, visibleCount: number) => {
      const m = entranceDelayByIdRef.current;
      if (m.has(id)) return m.get(id)!;
      const d = computeNoteEntranceDelay(visualIndex, visibleCount, prefersReducedMotion);
      m.set(id, d);
      return d;
    },
    [prefersReducedMotion],
  );

  const { lists, counts } = useNoteListsShell();
  const [baseNotes, setBaseNotes] = useState<NoteRow[]>(
    () => (getCachedNotes(pathname) as NoteRow[] | null) ?? initialNotes,
  );
  const [listTabOrderIds, setListTabOrderIds] = useState<string[] | null>(null);
  const listsSorted = useMemo(() => {
    if (!listTabOrderIds) return lists;
    const map = new Map(lists.map((l) => [l.id, l]));
    return listTabOrderIds.map((id) => map.get(id)).filter((x): x is UserNoteListRow => x != null);
  }, [lists, listTabOrderIds]);

  useEffect(() => {
    // Always apply RSC `initialNotes`. Preferring `getCachedNotes() ?? initialNotes` caused stale
    // client cache to win after `router.refresh()` (add/delete flicker until manual reload).
    setBaseNotes(initialNotes);
    setCachedNotes(pathname, initialNotes);
  }, [initialNotes, pathname]);

  useEffect(() => {
    setCachedNotes(pathname, baseNotes);
  }, [pathname, baseNotes]);

  useEffect(() => {
    const serverIds = lists.map((l) => l.id);
    const serverSet = new Set(serverIds);
    setListTabOrderIds((prev) => {
      if (prev === null) return null;
      if (prev.some((id) => !serverSet.has(id))) return null;
      const missing = serverIds.filter((id) => !prev.includes(id));
      if (missing.length) return [...prev, ...missing];
      if (serverIds.length === prev.length && serverIds.every((id, i) => id === prev[i])) return null;
      return prev;
    });
  }, [lists]);

  const subscription = useSubscription();
  const formRef = useRef<HTMLFormElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [composerOverrideNoteListId, setComposerOverrideNoteListId] = useState<string | null>(null);
  const [isComposerListMenuOpen, setIsComposerListMenuOpen] = useState(false);
  const [composerListQuery, setComposerListQuery] = useState("");
  useEffect(() => {
    setComposerOverrideNoteListId(null);
    setComposerValue("");
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
  }, [composerNoteListId, pathname]);
  const [optimisticNotes, addOptimistic] = useOptimistic(baseNotes, applyNoteOptimistic);
  const [isAddPending, startAddTransition] = useTransition();
  const [isNotePending, startNoteTransition] = useTransition();
  const [, startListTabReorderTransition] = useTransition();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const goSequenceRef = useRef<{ armed: boolean; timer: number | null }>({
    armed: false,
    timer: null,
  });
  const keyboardRef = useRef({
    pathname: "",
    listsSorted: [] as UserNoteListRow[],
    orderedVisibleNotes: [] as NoteRow[],
    optimisticNotes: [] as NoteRow[],
    selectedNoteId: null as string | null,
    openCreateListModal: () => {},
    setSelectedNoteId: (() => {}) as Dispatch<SetStateAction<string | null>>,
    startNoteTransition: (() => {}) as typeof startNoteTransition,
    addOptimistic: (() => {}) as typeof addOptimistic,
    scheduleRefresh: () => {},
    onNoteDeleted: (() => {}) as ((deletedId: string) => void),
    prefetchRoute: (() => {}) as (href: string) => void,
    routerPush: (() => {}) as (href: string) => void,
  });

  const createListModal = useOverlayState();
  const deleteNotesModal = useOverlayState();
  const [newListTitle, setNewListTitle] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const renameListModal = useOverlayState();
  const [renameTarget, setRenameTarget] = useState<{ noteListId: string; slug: string } | null>(null);
  const [renameListTitle, setRenameListTitle] = useState("");
  const [renameListError, setRenameListError] = useState<string | null>(null);
  const [renameListPending, setRenameListPending] = useState(false);
  const [renamedTitlesById, setRenamedTitlesById] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{
    noteListId: string;
    slug: string;
    noteCount: number;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [listDeleteInlineError, setListDeleteInlineError] = useState<string | null>(null);

  const refreshTimerRef = useRef<number | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      router.refresh();
      refreshTimerRef.current = null;
    }, 180);
  }, [router]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const noteChipActive = (href: string) => pathname === href;
  const prefetchRoute = useCallback(
    (href: string) => {
      void router.prefetch(href);
      void prefetchNotesForPath(href);
    },
    [router],
  );

  useEffect(() => {
    // Warm likely next navigations.
    void prefetchNotesForPath("/notes/all");
    for (const l of lists.slice(0, 3)) {
      void prefetchNotesForPath(`/notes/${l.slug}`);
    }
  }, [lists]);

  const focusNoteTitleForId = useCallback((id: string) => {
    queueMicrotask(() => {
      const row = document.querySelector(`[data-note-id="${id}"]`);
      (row?.querySelector<HTMLElement>("[data-note-title]") as HTMLElement | null)?.focus();
    });
  }, []);

  const focusNextAfterDelete = useCallback(
    (deletedId: string) => {
      const ids = keyboardRef.current.orderedVisibleNotes.map((t) => t.id);
      const remaining = ids.filter((id) => id !== deletedId);
      const deletedIdx = ids.indexOf(deletedId);
      const targetIdx = deletedIdx < 0 ? 0 : Math.min(deletedIdx, Math.max(remaining.length - 1, 0));
      const nextId = remaining[targetIdx] ?? null;
      setSelectedNoteId(nextId);
      if (nextId) focusNoteTitleForId(nextId);
    },
    [focusNoteTitleForId],
  );

  const noteFilterChipClass = (href: string) =>
    [
      "rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
      "inline-flex items-center whitespace-nowrap leading-none",
      noteChipActive(href)
        ? "bg-[#ececec] text-foreground"
        : "text-muted hover:text-foreground/80",
    ].join(" ");

  const visibleNotes = optimisticNotes;
  const [renderLimit, setRenderLimit] = useState(FAST_RENDER_LIMIT);

  useEffect(() => {
    setRenderLimit(FAST_RENDER_LIMIT);
  }, [pathname]);

  useEffect(() => {
    if (visibleNotes.length <= renderLimit) return;
    const id = window.setTimeout(() => {
      setRenderLimit((n) => Math.min(n + FAST_RENDER_STEP, visibleNotes.length));
    }, 80);
    return () => window.clearTimeout(id);
  }, [visibleNotes.length, renderLimit]);

  const renderedVisibleNotes = useMemo(
    () => visibleNotes.slice(0, renderLimit),
    [visibleNotes, renderLimit],
  );
  const hasMoreRendered = visibleNotes.length > renderLimit;

  useEffect(() => {
    if (!selectedNoteId) return;
    const idx = visibleNotes.findIndex((t) => t.id === selectedNoteId);
    if (idx >= renderLimit) {
      setRenderLimit((prev) => Math.min(Math.max(prev, idx + 1), visibleNotes.length));
    }
    const raf = window.requestAnimationFrame(() => {
      const idSel =
        typeof globalThis.CSS !== "undefined" && typeof globalThis.CSS.escape === "function"
          ? globalThis.CSS.escape(selectedNoteId)
          : selectedNoteId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      document.querySelector(`[data-note-id="${idSel}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedNoteId, visibleNotes, renderLimit]);

  function noteListHref(slug: string) {
    return `/notes/${slug}`;
  }

  function getListDisplayTitle(list: UserNoteListRow) {
    return renamedTitlesById[list.id] ?? list.title;
  }

  function isTabActiveForList(slug: string) {
    return pathname === `/notes/${slug}`;
  }

  async function submitCreateList(e: React.FormEvent) {
    e.preventDefault();
    setCreateListError(null);
    const title = newListTitle.trim();
    if (!title) {
      setCreateListError("Enter a folder name.");
      return;
    }

    if (!subscription.isPro && !subscription.canCreateNoteList()) {
      toast.danger("Free plan allows 1 folder. Upgrade for unlimited folders.", { timeout: 4500 });
      subscription.openPaymentModal({ dismissible: false });
      return;
    }

    setCreatePending(true);
    const result = await createNoteListAction(title);
    setCreatePending(false);
    if (result.ok) {
      setNewListTitle("");
      createListModal.close();
      router.push(`/${result.slug}`);
      scheduleRefresh();
    } else {
      setCreateListError(result.error);
      if (!subscription.isPro && /upgrade/i.test(result.error)) {
        toast.danger(result.error, { timeout: 4500 });
        subscription.openPaymentModal({ dismissible: false });
      }
    }
  }

  function openDeleteFlow(noteListId: string, slug: string) {
    setContextMenu(null);
    const noteCount = counts.byListId[noteListId] ?? 0;
    setDeleteError(null);
    setListDeleteInlineError(null);
    // UX: Silme onayı modalını her durumda göster. (noteCount==0 ise iki seçenek de
    // pratikte aynı davranır; kullanıcı yine de ne olduğunu görebilsin.)
    setDeleteTarget({ noteListId, slug, noteCount });
    deleteNotesModal.open();
  }

  function openRenameFlow(noteListId: string, slug: string, title: string) {
    setContextMenu(null);
    setRenameTarget({ noteListId, slug });
    setRenameListTitle(title);
    setRenameListError(null);
    renameListModal.open();
  }

  async function submitRenameList(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    const nextTitle = renameListTitle.trim();
    if (!nextTitle) {
      setRenameListError("Enter a folder name.");
      return;
    }

    setRenameListPending(true);
    setRenameListError(null);
    const result = await renameNoteListAction(renameTarget.noteListId, nextTitle);
    setRenameListPending(false);

    if (!result.ok) {
      setRenameListError(result.error);
      return;
    }

    setRenamedTitlesById((prev) => ({ ...prev, [renameTarget.noteListId]: nextTitle }));
    renameListModal.close();
    setRenameTarget(null);

    const oldPath = noteListHref(renameTarget.slug);
    const newPath = noteListHref(result.slug);
    if (pathname === oldPath && oldPath !== newPath) {
      router.push(newPath);
    }
    scheduleRefresh();
    toast.success("Folder renamed.", { timeout: 2200 });
  }

  function afterListDeleted(slug: string) {
    deleteNotesModal.close();
    setDeleteTarget(null);
    setDeleteError(null);
    const path = `/${slug}`;
    // `usePathname()` URL segmentiyle birebir eşleşmeyebiliyor (örn. farklı harf büyüklüğü veya
    // trailing slash). Silinen liste sayfasındaysa her durumda `/all`'a geç.
    const normalize = (p: string) => p.replace(/\/+$/, "").toLowerCase();
    if (normalize(pathname) === normalize(path)) router.push("/notes/all");
    scheduleRefresh();
  }

  async function confirmDeleteWithMode(mode: DeleteNoteListMode) {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const r = await deleteNoteListAction(deleteTarget.noteListId, mode);
    setDeleteBusy(false);
    if (r.ok) {
      toast.success("Folder deleted.", { timeout: 2500 });
      afterListDeleted(deleteTarget.slug);
    } else {
      setDeleteError(r.error);
      toast.danger(r.error, { timeout: 4500 });
    }
  }

  function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    const title = composerValue.trim();
    if (!title) {
      setAddError("Enter a note title.");
      return;
    }

    const effectiveComposerNoteListId = composerOverrideNoteListId ?? composerNoteListId;
    const shouldRenderOptimisticInCurrentView =
      view === "all" || effectiveComposerNoteListId === composerNoteListId;

    if (!subscription.isPro && !subscription.canAddNote(effectiveComposerNoteListId)) {
      const isInbox = !effectiveComposerNoteListId;
      toast.danger(
        isInbox
          ? "You've reached the 25 note inbox limit (All). Upgrade to add more."
          : "This folder is full (10/10). Upgrade to add more notes.",
        { timeout: 4500 },
      );
      subscription.openPaymentModal({ dismissible: false });
      return;
    }

    const tempId = `optimistic-${crypto.randomUUID()}`;
    const submittedOverrideNoteListId = composerOverrideNoteListId;
    setComposerValue("");
    setComposerOverrideNoteListId(null);
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
    const fd = new FormData();
    fd.set("title", title);
    if (effectiveComposerNoteListId) fd.set("note_list_id", effectiveComposerNoteListId);
    startAddTransition(async () => {
      if (shouldRenderOptimisticInCurrentView) {
        addOptimistic({
          type: "add",
          note: { id: tempId, title, is_completed: false, note_list_id: effectiveComposerNoteListId },
        });
      }
      const result = await addNoteAction(null, fd);
      if (result?.error) {
        if (shouldRenderOptimisticInCurrentView) {
          addOptimistic({ type: "delete", id: tempId });
        }
        setAddError(result.error);
        const err = result.error;
        const isDefaultListFailure =
          /default list/i.test(err) ||
          err.includes("Could not find your default list.") ||
          err.includes("Could not find or create your default list");
        if (
          !subscription.isPro &&
          (/upgrade/i.test(err) || isDefaultListFailure)
        ) {
          toast.danger(err, { timeout: 4500 });
          subscription.openPaymentModal({ dismissible: false });
        }
      } else if (!shouldRenderOptimisticInCurrentView && submittedOverrideNoteListId) {
        const target = lists.find((l) => l.id === submittedOverrideNoteListId);
        toast.success(`Note added to ${target?.title ?? "selected folder"}.`, { timeout: 2200 });
      }
      scheduleRefresh();
    });
  }

  const listTabSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleListTabsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = listsSorted.findIndex((l) => l.id === String(active.id));
    const newIndex = listsSorted.findIndex((l) => l.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previousIds = listTabOrderIds ?? listsSorted.map((l) => l.id);
    const nextLists = arrayMove(listsSorted, oldIndex, newIndex);
    const nextIds = nextLists.map((l) => l.id);
    setListTabOrderIds(nextIds);
    startListTabReorderTransition(async () => {
      const result = await reorderNoteListsAction(nextIds);
      if (!result.ok) {
        toast.danger(result.error, { timeout: 4000 });
        setListTabOrderIds(previousIds);
        return;
      }
    });
  }

  const noteRowHandlers = useMemo<NoteRowHandlers>(
    () => ({
      lists: lists.map((list) => ({ id: list.id, title: list.title })),
      view,
      composerNoteListId,
      setSelectedNoteId,
      isNotePending,
      startNoteTransition,
      addOptimistic,
      scheduleRefresh,
      onNoteDeleted: focusNextAfterDelete,
    }),
    [
      lists,
      view,
      composerNoteListId,
      setSelectedNoteId,
      isNotePending,
      startNoteTransition,
      addOptimistic,
      scheduleRefresh,
      focusNextAfterDelete,
    ],
  );

  const composerTargetList = listsSorted.find((list) => list.id === composerOverrideNoteListId) ?? null;
  const composerMentionMatches = useMemo(() => {
    const q = composerListQuery.trim().toLowerCase();
    if (!q) return listsSorted;
    return listsSorted.filter((list) => list.title.toLowerCase().includes(q));
  }, [listsSorted, composerListQuery]);

  function handleComposerChange(next: string) {
    setComposerValue(next);
    const m = next.match(/(?:^|\s)@([^\s]*)$/);
    if (!m) {
      setIsComposerListMenuOpen(false);
      setComposerListQuery("");
      return;
    }
    setIsComposerListMenuOpen(true);
    setComposerListQuery(m[1] ?? "");
  }

  function applyComposerTargetList(noteListId: string) {
    const list = listsSorted.find((l) => l.id === noteListId);
    if (!list) return;
    setComposerOverrideNoteListId(list.id === composerNoteListId ? null : list.id);
    setComposerValue((prev) => prev.replace(/(?:^|\s)@[^\s]*$/, " ").replace(/\s{2,}/g, " "));
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
    queueMicrotask(() => composerInputRef.current?.focus());
  }

  keyboardRef.current = {
    pathname,
    listsSorted,
    orderedVisibleNotes: visibleNotes,
    optimisticNotes,
    selectedNoteId,
    openCreateListModal: () => {
      setCreateListError(null);
      setNewListTitle("");
      createListModal.open();
    },
    setSelectedNoteId,
    startNoteTransition,
    addOptimistic,
    scheduleRefresh,
    onNoteDeleted: focusNextAfterDelete,
    prefetchRoute,
    routerPush: (href: string) => {
      router.push(href);
      prefetchRoute(href);
    },
  };

  useEffect(() => {
    const disarmGo = () => {
      const t = goSequenceRef.current.timer;
      if (t != null) window.clearTimeout(t);
      goSequenceRef.current = { armed: false, timer: null };
    };
    const armGo = () => {
      disarmGo();
      goSequenceRef.current.armed = true;
      goSequenceRef.current.timer = window.setTimeout(disarmGo, 1200);
    };

    const normPath = (p: string) => {
      const s = p.replace(/\/+$/, "").toLowerCase();
      return s === "" ? "/" : s;
    };

    const navHrefs = () => {
      const k = keyboardRef.current;
      return ["/notes/all", ...k.listsSorted.map((l) => `/notes/${l.slug}`)];
    };

    const escapeNoteDomId = (id: string) =>
      typeof globalThis.CSS !== "undefined" && typeof globalThis.CSS.escape === "function"
        ? globalThis.CSS.escape(id)
        : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    const focusNoteTitleForId = (id: string) => {
      queueMicrotask(() => {
        const row = document.querySelector(`[data-note-id="${escapeNoteDomId(id)}"]`);
        (row?.querySelector<HTMLElement>("[data-note-title]") as HTMLElement | null)?.focus();
      });
    };

    const navByDelta = (delta: number) => {
      const hrefs = navHrefs();
      const cur = normPath(keyboardRef.current.pathname);
      let idx = hrefs.findIndex((h) => normPath(h) === cur);
      if (idx < 0) idx = 0;
      const next = (idx + delta + hrefs.length) % hrefs.length;
      const href = hrefs[next];
      if (href) keyboardRef.current.routerPush(href);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const typing = isTextTypingTarget(e.target);
      const k = keyboardRef.current;

      if (e.metaKey || e.ctrlKey) {
        if (!e.altKey && e.key === "Enter" && document.activeElement === composerInputRef.current) {
          e.preventDefault();
          formRef.current?.requestSubmit();
          return;
        }
        return;
      }

      if (typing) {
        return;
      }

      if (e.code === "Space") {
        const ae = document.activeElement;
        if (ae instanceof HTMLElement && ae.closest("header")) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === "Escape") {
        const composerEl = composerInputRef.current;
        if (composerEl && document.activeElement === composerEl) {
          composerEl.blur();
          e.preventDefault();
          return;
        }
        if (k.selectedNoteId) {
          k.setSelectedNoteId(null);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(YALP_OPEN_KEYBOARD_SHORTCUTS));
        return;
      }

      if (e.key === "[" && !e.shiftKey) {
        e.preventDefault();
        navByDelta(-1);
        return;
      }
      if (e.key === "]" && !e.shiftKey) {
        e.preventDefault();
        navByDelta(1);
        return;
      }

      if ((e.key === "g" || e.key === "G") && !e.shiftKey) {
        if (goSequenceRef.current.armed) {
          disarmGo();
          e.preventDefault();
          return;
        }
        armGo();
        e.preventDefault();
        return;
      }

      if (goSequenceRef.current.armed) {
        const kn = e.key.toLowerCase();
        if (kn === "a" || kn === "i" || kn === "u" || kn === "p") {
          disarmGo();
          e.preventDefault();
          if (kn === "a") k.routerPush("/notes/all");
          else if (kn === "i") k.routerPush("/mcp");
          else if (kn === "u") window.dispatchEvent(new CustomEvent(YALP_OPEN_PROFILE));
          else if (kn === "p") window.dispatchEvent(new CustomEvent(YALP_OPEN_PLANS));
          return;
        }
        disarmGo();
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        composerInputRef.current?.focus();
        return;
      }

      if (e.code === "KeyL") {
        e.preventDefault();
        k.openCreateListModal();
        return;
      }

      if (e.code === "KeyJ" || e.code === "KeyK") {
        const ids = k.orderedVisibleNotes.map((t) => t.id);
        if (ids.length === 0) return;
        e.preventDefault();
        const cur = k.selectedNoteId ? ids.indexOf(k.selectedNoteId) : -1;
        let nextIdx: number;
        if (e.code === "KeyK") {
          nextIdx = cur <= 0 ? 0 : cur - 1;
        } else {
          nextIdx = cur < 0 ? 0 : Math.min(cur + 1, ids.length - 1);
        }
        const nextId = ids[nextIdx] ?? null;
        k.setSelectedNoteId(nextId);
        if (nextId) focusNoteTitleForId(nextId);
        return;
      }

      if (e.key === "Delete" && e.shiftKey) {
        const tid = k.selectedNoteId;
        if (!tid) return;
        const note = k.optimisticNotes.find((t) => t.id === tid);
        if (!note) return;
        e.preventDefault();
        k.startNoteTransition(async () => {
          k.addOptimistic({ type: "delete", id: note.id });
          const res = await deleteNoteAction(note.id);
          if ("error" in res) {
            k.addOptimistic({ type: "add", note });
            toast.danger("Could not delete note.", { timeout: 4500 });
            k.scheduleRefresh();
            return;
          }
          toast.success("Note deleted.", { timeout: 2500 });
          k.setSelectedNoteId(null);
          k.onNoteDeleted?.(note.id);
          k.scheduleRefresh();
        });
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      disarmGo();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="today-shell flex w-full flex-col text-foreground">
      {listDeleteInlineError ? (
        <p className="mb-2 text-sm text-[color:var(--color-danger)]" role="alert">
          {listDeleteInlineError}
        </p>
      ) : null}
      <div className="mb-5 flex w-full items-center gap-3">
        {/* Mobile: select a list instead of horizontal chips. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
          <Dropdown.Root>
            <Dropdown.Trigger>
              <span
                className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[12px] border border-[#e6e6e6] bg-white px-3 py-2 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                aria-label="Select folder"
              >
                <span className="truncate">
                  {pathname === "/notes/all"
                    ? `All • ${counts.all}`
                    : (() => {
                        const activeList = listsSorted.find((l) => isTabActiveForList(l.slug));
                        return activeList ? getListDisplayTitle(activeList) : "Select folder";
                      })()}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.75} className="text-muted" />
              </span>
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom start">
              <Dropdown.Menu aria-label="Folders">
                <Dropdown.Item
                  textValue="All"
                  onAction={() => router.push("/notes/all")}
                >
                  All <span className="mx-[2px] text-muted/70">•</span> {counts.all}
                </Dropdown.Item>
                {listsSorted.map((list) => (
                  <Dropdown.Item
                    key={list.id}
                    textValue={list.title}
                    onAction={() => router.push(noteListHref(list.slug))}
                  >
                    {getListDisplayTitle(list)}
                    <span className="mx-[2px] text-muted/70">•</span> {counts.byListId[list.id] ?? 0}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>

          <button
            type="button"
            className="shrink-0 rounded-[12px] p-2 text-muted hover:bg-[#f3f3f3] hover:text-foreground"
            aria-label="Add folder"
            onClick={() => {
              setCreateListError(null);
              setNewListTitle("");
              createListModal.open();
            }}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="text-current" />
          </button>
        </div>

        {/* Desktop: horizontal list chips (drag tabs to reorder). */}
        <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-[2px] sm:flex" aria-label="Folder filters">
          <DndContext
            id="yalp-dnd-list-tabs"
            sensors={listTabSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleListTabsDragEnd}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-[2px]">
              <Link
                href="/notes/all"
                className={noteFilterChipClass("/notes/all")}
                aria-current={pathname === "/notes/all" ? "page" : undefined}
                onMouseEnter={() => prefetchRoute("/notes/all")}
                onFocus={() => prefetchRoute("/notes/all")}
              >
                All{" "}
                {noteChipActive("/notes/all") ? (
                  <>
                    <span className="mx-[2px] text-muted/70">•</span> {counts.all}
                  </>
                ) : null}
              </Link>
              <SortableContext items={listsSorted.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
                {listsSorted.map((list) => (
                  <SortableListTabChip
                    key={list.id}
                    list={list}
                    href={noteListHref(list.slug)}
                    chipClassName={noteFilterChipClass(noteListHref(list.slug))}
                    isActive={isTabActiveForList(list.slug)}
                    count={counts.byListId[list.id] ?? 0}
                    displayTitle={getListDisplayTitle(list)}
                    onPrefetch={prefetchRoute}
                    onListContextMenu={(l, e) => {
                      setContextMenu({
                        noteListId: l.id,
                        slug: l.slug,
                        title: getListDisplayTitle(l),
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                  />
                ))}
              </SortableContext>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-[12px] px-2 py-1.5 text-muted hover:bg-[#f3f3f3] hover:text-foreground"
                aria-label="Add folder"
                onClick={() => {
                  setCreateListError(null);
                  setNewListTitle("");
                  createListModal.open();
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="text-current" />
              </button>
            </div>
          </DndContext>
        </nav>
      </div>

      {contextMenu ? (
        <Dropdown.Root
          // Controlled open state via `contextMenu`.
          isOpen
          onOpenChange={(open) => {
            if (!open) setContextMenu(null);
          }}
        >
          {/* Invisible anchor: dropdown is positioned relative to this trigger. */}
          <Dropdown.Trigger
            aria-label="Folder actions"
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
              padding: 0,
              opacity: 0,
              pointerEvents: "none",
            }}
          >
            <span aria-hidden />
          </Dropdown.Trigger>
          <Dropdown.Popover
            placement="bottom start"
            style={{ width: "max-content", minWidth: "0px" }}
          >
            <Dropdown.Menu className="w-fit max-w-max min-w-0">
              <Dropdown.Item
                onAction={() => openRenameFlow(contextMenu.noteListId, contextMenu.slug, contextMenu.title)}
              >
                <div className="flex items-center gap-[8px]">
                  <Pencil size={16} />
                  <span>Rename</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item onAction={() => openDeleteFlow(contextMenu.noteListId, contextMenu.slug)}>
                <div className="flex items-center gap-[8px]">
                  <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.75} />
                  <span>Delete</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      ) : null}

      <Modal.Root state={createListModal}>
        <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
          <span aria-hidden />
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="mb-[24px]">
                <Modal.Heading>Create new folder</Modal.Heading>
              </Modal.Header>
              <form onSubmit={submitCreateList}>
                <Modal.Body className="flex flex-col gap-3 pt-0">
                  {createListError ? (
                    <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                      {createListError}
                    </p>
                  ) : null}
                  <TextField.Root
                    name="list_title"
                    value={newListTitle}
                    onChange={setNewListTitle}
                    isRequired
                  >
                    <Label>Folder name</Label>
                    <Input placeholder="e.g. Groceries" autoFocus />
                  </TextField.Root>
                </Modal.Body>
                <Modal.Footer className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    slot="close"
                    type="button"
                    isDisabled={createPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isPending={createPending}>
                    Create
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <Modal.Root state={renameListModal}>
        <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
          <span aria-hidden />
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="mb-[24px]">
                <Modal.Heading>Rename folder</Modal.Heading>
              </Modal.Header>
              <form onSubmit={submitRenameList}>
                <Modal.Body className="flex flex-col gap-3 pt-0">
                  {renameListError ? (
                    <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                      {renameListError}
                    </p>
                  ) : null}
                  <TextField.Root
                    name="rename_list_title"
                    value={renameListTitle}
                    onChange={setRenameListTitle}
                    isRequired
                  >
                    <Label>Folder name</Label>
                    <Input placeholder="e.g. Work" autoFocus />
                  </TextField.Root>
                </Modal.Body>
                <Modal.Footer className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    slot="close"
                    type="button"
                    isDisabled={renameListPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" isPending={renameListPending}>
                    Save
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <Modal.Root state={deleteNotesModal}>
        <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
          <span aria-hidden />
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete folder?</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3 text-[13px] leading-snug text-foreground">
                {deleteError ? (
                  <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                    {deleteError}
                  </p>
                ) : null}
                <p>
                  This folder has <strong>{deleteTarget?.noteCount ?? 0}</strong> note
                  {(deleteTarget?.noteCount ?? 0) === 1 ? "" : "s"}. What should happen to
                  them?
                </p>
              </Modal.Body>
              <Modal.Footer className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  isDisabled={deleteBusy}
                  onPress={() => void confirmDeleteWithMode("move_notes_to_unassigned")}
                >
                  Keep notes in All
                </Button>
                <Button
                  variant="primary"
                  isDisabled={deleteBusy}
                  isPending={deleteBusy}
                  onPress={() => void confirmDeleteWithMode("delete_notes")}
                >
                  Delete notes with folder
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <div className="mb-6">
        <form
          ref={formRef}
          key={composerNoteListId ?? "none"}
          onSubmit={handleAddNote}
          className="relative"
        >
          <div className="relative flex min-h-10 items-center gap-2 rounded-[16px] border border-[#e4e4e4] bg-white pr-3 shadow-[0_2px_10px_rgba(0,0,0,0.022),0_1px_2px_rgba(0,0,0,0.016)]">
            {composerTargetList ? (
              <button
                type="button"
                className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00b5e9]/12 px-2 py-1 font-title text-[12px] leading-4 font-medium text-[#00b5e9]"
                onClick={() => setComposerOverrideNoteListId(null)}
                title="Clear selected folder"
                aria-label={`Clear selected folder ${composerTargetList.title}`}
              >
                <span>@{composerTargetList.title}</span>
                <X size={12} />
              </button>
            ) : null}
            <input
              ref={composerInputRef}
              name="title"
              type="text"
              autoComplete="off"
              placeholder="New note @folder"
              disabled={isAddPending}
              value={composerValue}
              onChange={(e) => handleComposerChange(e.target.value)}
              className={[
                "min-w-0 flex-1 border-0 bg-transparent pt-2.5 pb-[11px] text-[13px] leading-5 text-foreground outline-none placeholder:text-muted",
                composerTargetList ? "pl-0" : "pl-4",
              ].join(" ")}
            />
            <kbd className="hidden shrink-0 items-center justify-center rounded-[6px] border border-[#e6e6e6] bg-[#fafafa] px-1.5 py-1 font-sans text-[11px] font-medium leading-none text-muted sm:inline-flex">
              N
            </kbd>

            {isComposerListMenuOpen ? (
              <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-full rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                {composerMentionMatches.length > 0 ? (
                  composerMentionMatches.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-[#f5f5f5]"
                      onClick={() => applyComposerTargetList(list.id)}
                    >
                      {getListDisplayTitle(list)}
                    </button>
                  ))
                ) : (
                  <p className="px-2.5 py-2 text-[12px] text-muted">No matching folder</p>
                )}
              </div>
            ) : null}
          </div>
          {addError ? (
            <p className="mt-2 text-sm text-[color:var(--color-danger)]" role="alert">
              {addError}
            </p>
          ) : null}
        </form>
      </div>

      <section
        aria-label="Inbox"
      >
        {visibleNotes.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">No notes yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-y-[2px] sm:grid-cols-2 sm:gap-x-3">
            <AnimatePresence initial mode="popLayout">
              {renderedVisibleNotes.map((note, index) => (
                <PresenceNoteRow
                  key={note.id}
                  todo={note}
                  entranceDelay={getEntranceDelay(note.id, index, renderedVisibleNotes.length)}
                  skipEntranceAnimation={skipListEntranceAnimations}
                  showDetailAction={!note.parent_id}
                  {...noteRowHandlers}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {hasMoreRendered ? (
          <div className="pt-3 text-center text-[12px] text-muted">Loading more notes…</div>
        ) : null}
      </section>
      </div>
  );
}
