"use client";

import {
  addTodoAction,
  deleteTodoAction,
  reorderAllTodosAction,
  reorderTodosAction,
  toggleTodoAction,
} from "@/app/(app)/today/actions";
import {
  createListAction,
  deleteListAction,
  renameListAction,
  reorderListsAction,
  type DeleteListMode,
} from "@/app/(app)/lists/actions";
import { useListsShell, type UserListRow } from "@/app/(app)/lists-shell";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  ArrowDown01Icon,
  SlidersHorizontalIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { Pencil, X } from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
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
import { getCachedTodos, prefetchTodosForPath, setCachedTodos } from "@/hooks/useTodosStore";
import { isClientDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import {
  YALP_OPEN_KEYBOARD_SHORTCUTS,
  YALP_OPEN_PROFILE,
  YALP_OPEN_PLANS,
} from "@/lib/yalp-shortcut-events";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import type { CSSProperties, MouseEvent } from "react";
import {
  type TodoOptimisticAction,
  type TodoRow,
  type TodoRowHandlers,
  PresenceTodoRow,
  SortableTodoItem,
} from "./todo-row";

/** Çok satırda toplam cascade süresini ~0,5s içinde tut; sıra değişince aynı id’ye aynı gecikme (ref ile). */
const LIST_ENTRANCE_INDEX_CAP = 40;
const LIST_ENTRANCE_TIME_BUDGET_SEC = 0.52;
const FAST_RENDER_LIMIT = 240;
const FAST_RENDER_STEP = 220;

function computeTodoEntranceDelay(
  visualIndex: number,
  visibleCount: number,
  prefersReducedMotion: boolean | null,
): number {
  if (prefersReducedMotion) return 0;
  const cappedCount = Math.max(1, Math.min(visibleCount, LIST_ENTRANCE_INDEX_CAP));
  const stagger = Math.min(0.038, LIST_ENTRANCE_TIME_BUDGET_SEC / cappedCount);
  return Math.min(visualIndex, LIST_ENTRANCE_INDEX_CAP) * stagger;
}

export type TodayClientProps = {
  initialTodos: TodoRow[];
  /** Reserved for future view-specific behavior (All / Today / custom list). */
  view?: "all" | "today" | "list";
  composerListId: string | null;
  initialShowCompleted?: boolean;
  /** Passed by pages for future header customization; currently unused in the client shell. */
  sectionHeaderLabel?: string;
};

type SortableListTabChipProps = {
  list: UserListRow;
  displayTitle: string;
  href: string;
  chipClassName: string;
  isActive: boolean;
  count: number;
  onListContextMenu: (list: UserListRow, e: MouseEvent) => void;
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
  listId: string;
  slug: string;
  title: string;
  x: number;
  y: number;
};

function reorderTodosByIds(state: TodoRow[], orderedIds: string[]): TodoRow[] {
  const byId = new Map(state.map((t) => [t.id, t] as const));
  const ordered: TodoRow[] = [];
  const seen = new Set<string>();

  for (const id of orderedIds) {
    const t = byId.get(id);
    if (!t) continue;
    ordered.push(t);
    seen.add(id);
  }

  for (const t of state) {
    if (!seen.has(t.id)) ordered.push(t);
  }

  return ordered;
}

/** Merge a visible-only order into the full id list (same rules as drag-end persistence). */
function mergeVisibleOrderIntoFull(
  fullIds: string[],
  visibleOrderedIds: string[],
  visibleSet: Set<string>,
): string[] {
  const mergedIds: string[] = [];
  let i = 0;
  for (const id of fullIds) {
    if (visibleSet.has(id)) {
      mergedIds.push(visibleOrderedIds[i] ?? id);
      i += 1;
    } else {
      mergedIds.push(id);
    }
  }
  return mergedIds;
}

function applyTodoOptimistic(state: TodoRow[], action: TodoOptimisticAction): TodoRow[] {
  switch (action.type) {
    case "toggle":
      return state.map((t) =>
        t.id === action.id ? { ...t, is_completed: action.completed } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "add":
      return [action.todo, ...state];
    case "duplicateAfter": {
      const idx = state.findIndex((t) => t.id === action.afterId);
      if (idx < 0) return [...state, action.todo];
      return [...state.slice(0, idx + 1), action.todo, ...state.slice(idx + 1)];
    }
    case "moveList":
      return state.map((t) => (t.id === action.id ? { ...t, list_id: action.list_id } : t));
    case "reorder":
      return reorderTodosByIds(state, action.orderedIds);
    case "updateTitle":
      return state.map((t) => (t.id === action.id ? { ...t, title: action.title } : t));
  }
}

export function TodayClient({ initialTodos, composerListId, view, initialShowCompleted = true }: TodayClientProps) {
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
  const routeListKey = `${pathname}::${composerListId ?? ""}`;
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
      const d = computeTodoEntranceDelay(visualIndex, visibleCount, prefersReducedMotion);
      m.set(id, d);
      return d;
    },
    [prefersReducedMotion],
  );

  const { lists, counts } = useListsShell();
  const [baseTodos, setBaseTodos] = useState<TodoRow[]>(
    () => (getCachedTodos(pathname) as TodoRow[] | null) ?? initialTodos,
  );
  const [listTabOrderIds, setListTabOrderIds] = useState<string[] | null>(null);
  const listsSorted = useMemo(() => {
    if (!listTabOrderIds) return lists;
    const map = new Map(lists.map((l) => [l.id, l]));
    return listTabOrderIds.map((id) => map.get(id)).filter((x): x is UserListRow => x != null);
  }, [lists, listTabOrderIds]);

  useEffect(() => {
    // Always apply RSC `initialTodos`. Preferring `getCachedTodos() ?? initialTodos` caused stale
    // client cache to win after `router.refresh()` (add/delete flicker until manual reload).
    setBaseTodos(initialTodos);
    setCachedTodos(pathname, initialTodos);
  }, [initialTodos, pathname]);

  useEffect(() => {
    setCachedTodos(pathname, baseTodos);
  }, [pathname, baseTodos]);

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
  const [composerOverrideListId, setComposerOverrideListId] = useState<string | null>(null);
  const [isComposerListMenuOpen, setIsComposerListMenuOpen] = useState(false);
  const [composerListQuery, setComposerListQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState<boolean>(initialShowCompleted);
  const lastSyncedShowCompletedRef = useRef<boolean>(initialShowCompleted);

  useEffect(() => {
    setShowCompleted(initialShowCompleted);
    lastSyncedShowCompletedRef.current = initialShowCompleted;
  }, [initialShowCompleted]);

  useEffect(() => {
    if (showCompleted === lastSyncedShowCompletedRef.current) return;
    const nextValue = showCompleted;
    const timer = window.setTimeout(() => {
      void fetch("/api/preferences/show-completed", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showCompleted: nextValue }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Failed to persist preference.");
          }
        })
        .then(() => {
          lastSyncedShowCompletedRef.current = nextValue;
        })
        .catch(() => {
          toast.danger("Could not save completed-task visibility preference.", { timeout: 3500 });
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [showCompleted]);

  useEffect(() => {
    setComposerOverrideListId(null);
    setComposerValue("");
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
  }, [composerListId, pathname]);
  const [uiOrderIds, setUiOrderIds] = useState<string[] | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [optimisticTodos, addOptimistic] = useOptimistic(baseTodos, applyTodoOptimistic);
  const [isAddPending, startAddTransition] = useTransition();
  const [isTodoPending, startTodoTransition] = useTransition();
  const [, startListTabReorderTransition] = useTransition();
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const latestOrderRef = useRef<string[] | null>(null);
  const goSequenceRef = useRef<{ armed: boolean; timer: number | null }>({
    armed: false,
    timer: null,
  });
  const keyboardRef = useRef({
    pathname: "",
    listsSorted: [] as UserListRow[],
    orderedVisibleTodos: [] as TodoRow[],
    optimisticTodos: [] as TodoRow[],
    selectedTodoId: null as string | null,
    canReorder: false,
    hasCompletedTodos: false,
    markAllIncomplete: () => {},
    moveCompletedToBottom: () => {},
    openCreateListModal: () => {},
    setShowCompleted: (() => {}) as Dispatch<SetStateAction<boolean>>,
    setSelectedTodoId: (() => {}) as Dispatch<SetStateAction<string | null>>,
    startTodoTransition: (() => {}) as typeof startTodoTransition,
    addOptimistic: (() => {}) as typeof addOptimistic,
    scheduleRefresh: () => {},
    onTodoDeleted: (() => {}) as ((deletedId: string) => void),
    prefetchRoute: (() => {}) as (href: string) => void,
    routerPush: (() => {}) as (href: string) => void,
  });

  const createListModal = useOverlayState();
  const deleteTasksModal = useOverlayState();
  const [newListTitle, setNewListTitle] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const renameListModal = useOverlayState();
  const [renameTarget, setRenameTarget] = useState<{ listId: string; slug: string } | null>(null);
  const [renameListTitle, setRenameListTitle] = useState("");
  const [renameListError, setRenameListError] = useState<string | null>(null);
  const [renameListPending, setRenameListPending] = useState(false);
  const [renamedTitlesById, setRenamedTitlesById] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{
    listId: string;
    slug: string;
    taskCount: number;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [listDeleteInlineError, setListDeleteInlineError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const preDragOrderRef = useRef<string[] | null>(null);
  const reorderPersistInFlightRef = useRef(false);
  const reorderPersistQueuedRef = useRef<{
    orderedIds: string[];
    rollbackOrder: string[];
  } | null>(null);

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

  useEffect(() => {
    if (!reorderError) return;
    toast.danger(reorderError, { timeout: 4000 });
    setReorderError(null);
  }, [reorderError]);

  const chipActive = (href: string) => pathname === href;
  const prefetchRoute = useCallback(
    (href: string) => {
      void router.prefetch(href);
      void prefetchTodosForPath(href);
    },
    [router],
  );

  useEffect(() => {
    // Warm likely next navigations.
    void prefetchTodosForPath("/all");
    void prefetchTodosForPath("/today");
    for (const l of lists.slice(0, 3)) {
      void prefetchTodosForPath(`/${l.slug}`);
    }
  }, [lists]);

  const focusNextAfterDelete = useCallback(
    (deletedId: string) => {
      const ids = keyboardRef.current.orderedVisibleTodos.map((t) => t.id);
      const remaining = ids.filter((id) => id !== deletedId);
      const deletedIdx = ids.indexOf(deletedId);
      const targetIdx = deletedIdx < 0 ? 0 : Math.min(deletedIdx, Math.max(remaining.length - 1, 0));
      const nextId = remaining[targetIdx] ?? null;
      setSelectedTodoId(nextId);
      if (!nextId) return;
      queueMicrotask(() => {
        const row = document.querySelector(`[data-todo-id="${nextId}"]`);
        row?.querySelector<HTMLInputElement>(".todo-checkbox-squircle")?.focus();
      });
    },
    [],
  );

  const filterChipClass = (href: string) =>
    [
      "rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
      "inline-flex items-center whitespace-nowrap leading-none",
      chipActive(href)
        ? "bg-[#ececec] text-foreground"
        : "text-muted hover:text-foreground/80",
    ].join(" ");

  async function markAllIncomplete() {
    const completed = optimisticTodos.filter((t) => Boolean(t.is_completed));
    if (completed.length === 0) return;

    startTodoTransition(async () => {
      completed.forEach((t) => addOptimistic({ type: "toggle", id: t.id, completed: false }));
      await Promise.all(completed.map((t) => toggleTodoAction(t.id, false)));
      scheduleRefresh();
    });
  }

  const visibleTodos = showCompleted
    ? optimisticTodos
    : optimisticTodos.filter((t) => !t.is_completed);

  const canReorder = Boolean(composerListId) || pathname === "/all";

  const visibleIds = useMemo(() => visibleTodos.map((t) => t.id), [visibleTodos]);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const orderedVisibleTodos =
    uiOrderIds && uiOrderIds.length === visibleIds.length
      ? reorderTodosByIds(visibleTodos, uiOrderIds)
      : visibleTodos;
  const [renderLimit, setRenderLimit] = useState(FAST_RENDER_LIMIT);

  useEffect(() => {
    setRenderLimit(FAST_RENDER_LIMIT);
  }, [pathname, showCompleted]);

  useEffect(() => {
    if (orderedVisibleTodos.length <= renderLimit) return;
    const id = window.setTimeout(() => {
      setRenderLimit((n) => Math.min(n + FAST_RENDER_STEP, orderedVisibleTodos.length));
    }, 80);
    return () => window.clearTimeout(id);
  }, [orderedVisibleTodos.length, renderLimit]);

  const renderedOrderedTodos = useMemo(
    () => orderedVisibleTodos.slice(0, renderLimit),
    [orderedVisibleTodos, renderLimit],
  );
  const renderedVisibleTodos = useMemo(
    () => visibleTodos.slice(0, renderLimit),
    [visibleTodos, renderLimit],
  );
  const hasMoreRendered = orderedVisibleTodos.length > renderLimit;
  const renderedVisibleIds = useMemo(() => renderedOrderedTodos.map((t) => t.id), [renderedOrderedTodos]);

  useEffect(() => {
    if (!selectedTodoId) return;
    const idx = orderedVisibleTodos.findIndex((t) => t.id === selectedTodoId);
    if (idx >= renderLimit) {
      setRenderLimit((prev) =>
        Math.min(Math.max(prev, idx + 1), orderedVisibleTodos.length),
      );
    }
    const raf = window.requestAnimationFrame(() => {
      const idSel =
        typeof globalThis.CSS !== "undefined" && typeof globalThis.CSS.escape === "function"
          ? globalThis.CSS.escape(selectedTodoId)
          : selectedTodoId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      document.querySelector(`[data-todo-id="${idSel}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedTodoId, orderedVisibleTodos, renderLimit]);

  useEffect(() => {
    if (!uiOrderIds) return;
    if (uiOrderIds.length !== visibleIds.length) {
      setUiOrderIds(null);
      return;
    }
    // If visible set changes (add/delete/filter), reset to server order.
    for (const id of uiOrderIds) {
      if (!visibleIdSet.has(id)) {
        setUiOrderIds(null);
        return;
      }
    }
  }, [uiOrderIds, visibleIds.length, visibleIdSet]);

  const hasCompletedTodos = useMemo(
    () => optimisticTodos.some((t) => Boolean(t.is_completed)),
    [optimisticTodos],
  );

  const moveCompletedToBottom = useCallback(() => {
    if (!canReorder || !hasCompletedTodos) return;

    const byId = new Map(optimisticTodos.map((t) => [t.id, t] as const));
    const fullIds = optimisticTodos.map((t) => t.id);
    const currentFullOrder =
      uiOrderIds && uiOrderIds.length === visibleIds.length
        ? mergeVisibleOrderIntoFull(fullIds, uiOrderIds, visibleIdSet)
        : fullIds;

    const incomplete = currentFullOrder.filter((id) => !byId.get(id)?.is_completed);
    const complete = currentFullOrder.filter((id) => Boolean(byId.get(id)?.is_completed));
    const newFullOrder = [...incomplete, ...complete];

    let unchanged = true;
    for (let i = 0; i < newFullOrder.length; i++) {
      if (newFullOrder[i] !== currentFullOrder[i]) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) return;

    const previousUiOrder = uiOrderIds ?? visibleIds;
    const newVisibleOrder = showCompleted ? newFullOrder : incomplete;

    startTodoTransition(async () => {
      latestOrderRef.current = newVisibleOrder;
      setUiOrderIds(newVisibleOrder);

      try {
        if (composerListId) {
          await reorderTodosAction(composerListId, newFullOrder);
        } else if (pathname === "/all") {
          await reorderAllTodosAction(newFullOrder);
        }
        scheduleRefresh();
        toast.success("Completed tasks moved to the bottom.", { timeout: 2000 });
      } catch {
        setUiOrderIds(previousUiOrder);
        latestOrderRef.current = previousUiOrder;
        setReorderError("Could not save the new order.");
      }
    });
  }, [
    canReorder,
    hasCompletedTodos,
    optimisticTodos,
    uiOrderIds,
    visibleIds,
    visibleIdSet,
    showCompleted,
    composerListId,
    pathname,
    scheduleRefresh,
    startTodoTransition,
  ]);

  async function persistReorderIfPossible(orderedIds: string[], rollbackOrder: string[]) {
    if (orderedIds.length === 0) return;
    // #region debug-log:persistReorderIfPossible
    if (isClientDebugIngestEnabled()) {
      void sendDebugIngest(
        {
          sessionId: "e410d4",
          runId: "pre-fix-reorder-1",
          hypothesisId: "H3-persist-reorder",
          location: "today-client.tsx:persistReorderIfPossible",
          message: "Persisting reorder to server action",
          data: {
            composerListId,
            orderedIdsLength: orderedIds.length,
            orderedIdsFirst: orderedIds[0] ?? null,
            orderedIdsLast: orderedIds[orderedIds.length - 1] ?? null,
          },
          timestamp: Date.now(),
        },
        { headerSessionId: "e410d4" },
      );
    }
    // #endregion
    // Merge: if completed are hidden, only the visible subset was reordered.
    // Preserve the relative placement of hidden items by reusing the subset slots.
    const fullIds = optimisticTodos.map((t) => t.id);
    const mergedIds = mergeVisibleOrderIntoFull(fullIds, orderedIds, visibleIdSet);

    try {
      if (composerListId) {
        await reorderTodosAction(composerListId, mergedIds);
      } else if (pathname === "/all") {
        await reorderAllTodosAction(mergedIds);
      }
      scheduleRefresh();
    } catch {
      // If another drag happened while this request was in-flight, keep the UI at the latest
      // queued order instead of reverting to a stale rollback.
      const latestQueuedOrdered = reorderPersistQueuedRef.current?.orderedIds;
      const latestDesired = latestQueuedOrdered ?? rollbackOrder;
      setUiOrderIds(latestDesired);
      latestOrderRef.current = latestDesired;
      setReorderError("Could not save the new order. Restored previous order.");
    }
  }

  async function reorderPersistWorker() {
    if (reorderPersistInFlightRef.current) return;
    reorderPersistInFlightRef.current = true;
    try {
      // Keep consuming the latest queued job until no more drag events happen.
      while (reorderPersistQueuedRef.current) {
        const job = reorderPersistQueuedRef.current;
        reorderPersistQueuedRef.current = null;
        if (!job) continue;
        await persistReorderIfPossible(job.orderedIds, job.rollbackOrder);
      }
    } finally {
      reorderPersistInFlightRef.current = false;
    }
  }

  function listHref(slug: string) {
    return `/${slug}`;
  }

  function getListDisplayTitle(list: UserListRow) {
    return renamedTitlesById[list.id] ?? list.title;
  }

  function isTabActiveForList(slug: string) {
    return pathname === `/${slug}`;
  }

  async function submitCreateList(e: React.FormEvent) {
    e.preventDefault();
    setCreateListError(null);
    const title = newListTitle.trim();
    if (!title) {
      setCreateListError("Enter a list name.");
      return;
    }

    if (!subscription.isPro && !subscription.canCreateList()) {
      toast.danger("Free plan allows 1 list. Upgrade for unlimited lists.", { timeout: 4500 });
      subscription.openPaymentModal({ dismissible: false });
      return;
    }

    setCreatePending(true);
    const result = await createListAction(title);
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

  function openDeleteFlow(listId: string, slug: string) {
    setContextMenu(null);
    const taskCount = counts.byListId[listId] ?? 0;
    setDeleteError(null);
    setListDeleteInlineError(null);
    // UX: Silme onayı modalını her durumda göster. (taskCount==0 ise iki seçenek de
    // pratikte aynı davranır; kullanıcı yine de ne olduğunu görebilsin.)
    setDeleteTarget({ listId, slug, taskCount });
    deleteTasksModal.open();
  }

  function openRenameFlow(listId: string, slug: string, title: string) {
    setContextMenu(null);
    setRenameTarget({ listId, slug });
    setRenameListTitle(title);
    setRenameListError(null);
    renameListModal.open();
  }

  async function submitRenameList(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    const nextTitle = renameListTitle.trim();
    if (!nextTitle) {
      setRenameListError("Enter a list name.");
      return;
    }

    setRenameListPending(true);
    setRenameListError(null);
    const result = await renameListAction(renameTarget.listId, nextTitle);
    setRenameListPending(false);

    if (!result.ok) {
      setRenameListError(result.error);
      return;
    }

    setRenamedTitlesById((prev) => ({ ...prev, [renameTarget.listId]: nextTitle }));
    renameListModal.close();
    setRenameTarget(null);

    const oldPath = listHref(renameTarget.slug);
    const newPath = listHref(result.slug);
    if (pathname === oldPath && oldPath !== newPath) {
      router.push(newPath);
    }
    scheduleRefresh();
    toast.success("List renamed.", { timeout: 2200 });
  }

  function afterListDeleted(slug: string) {
    deleteTasksModal.close();
    setDeleteTarget(null);
    setDeleteError(null);
    const path = `/${slug}`;
    // `usePathname()` URL segmentiyle birebir eşleşmeyebiliyor (örn. farklı harf büyüklüğü veya
    // trailing slash). Silinen liste sayfasındaysa her durumda `/all`'a geç.
    const normalize = (p: string) => p.replace(/\/+$/, "").toLowerCase();
    if (normalize(pathname) === normalize(path)) router.push("/all");
    scheduleRefresh();
  }

  async function confirmDeleteWithMode(mode: DeleteListMode) {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const r = await deleteListAction(deleteTarget.listId, mode);
    setDeleteBusy(false);
    if (r.ok) {
      toast.success("List deleted.", { timeout: 2500 });
      afterListDeleted(deleteTarget.slug);
    } else {
      setDeleteError(r.error);
      toast.danger(r.error, { timeout: 4500 });
    }
  }

  function handleAddTodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    const title = composerValue.trim();
    if (!title) {
      setAddError("Enter a task title.");
      return;
    }

    const effectiveComposerListId = composerOverrideListId ?? composerListId;
    const shouldRenderOptimisticInCurrentView =
      view === "all" || effectiveComposerListId === composerListId;

    if (!subscription.isPro && !subscription.canAddTodo(effectiveComposerListId)) {
      const isInbox = !effectiveComposerListId;
      toast.danger(
        isInbox
          ? "You've reached the 25 todo inbox limit (All). Upgrade to add more."
          : "This list is full (10/10). Upgrade to add more todos.",
        { timeout: 4500 },
      );
      subscription.openPaymentModal({ dismissible: false });
      return;
    }

    const tempId = `optimistic-${crypto.randomUUID()}`;
    const submittedOverrideListId = composerOverrideListId;
    setComposerValue("");
    setComposerOverrideListId(null);
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
    const fd = new FormData();
    fd.set("title", title);
    if (effectiveComposerListId) fd.set("list_id", effectiveComposerListId);
    startAddTransition(async () => {
      if (shouldRenderOptimisticInCurrentView) {
        addOptimistic({
          type: "add",
          todo: { id: tempId, title, is_completed: false, list_id: effectiveComposerListId },
        });
      }
      const result = await addTodoAction(null, fd);
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
      } else if (!shouldRenderOptimisticInCurrentView && submittedOverrideListId) {
        const target = lists.find((l) => l.id === submittedOverrideListId);
        toast.success(`Todo added to ${target?.title ?? "selected list"}.`, { timeout: 2200 });
      }
      scheduleRefresh();
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
      const result = await reorderListsAction(nextIds);
      if (!result.ok) {
        toast.danger(result.error, { timeout: 4000 });
        setListTabOrderIds(previousIds);
        return;
      }
    });
  }

  const draggedTodo = draggingTodoId
    ? orderedVisibleTodos.find((todo) => todo.id === draggingTodoId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    const currentOrder = uiOrderIds ?? visibleIds;
    preDragOrderRef.current = currentOrder;
    setReorderError(null);
    setDraggingTodoId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTodoId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previousOrder = preDragOrderRef.current ?? (uiOrderIds ?? visibleIds);
    const currentOrder = uiOrderIds ?? visibleIds;
    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
    latestOrderRef.current = nextOrder;
    setUiOrderIds(nextOrder);
    // Serialize reorder persistence so the DB always ends up with the latest drop order.
    reorderPersistQueuedRef.current = { orderedIds: nextOrder, rollbackOrder: previousOrder };
    if (!reorderPersistInFlightRef.current) {
      void reorderPersistWorker();
    }
  }

  function handleDragCancel() {
    setDraggingTodoId(null);
    if (preDragOrderRef.current) {
      setUiOrderIds(preDragOrderRef.current);
      latestOrderRef.current = preDragOrderRef.current;
    }
  }

  const todoRowHandlers = useMemo<TodoRowHandlers>(
    () => ({
      lists: lists.map((list) => ({ id: list.id, title: list.title })),
      view,
      composerListId,
      setSelectedTodoId,
      isTodoPending,
      startTodoTransition,
      addOptimistic,
      scheduleRefresh,
      onTodoDeleted: focusNextAfterDelete,
    }),
    [
      lists,
      view,
      composerListId,
      setSelectedTodoId,
      isTodoPending,
      startTodoTransition,
      addOptimistic,
      scheduleRefresh,
      focusNextAfterDelete,
    ],
  );

  const composerTargetList = listsSorted.find((list) => list.id === composerOverrideListId) ?? null;
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

  function applyComposerTargetList(listId: string) {
    const list = listsSorted.find((l) => l.id === listId);
    if (!list) return;
    setComposerOverrideListId(list.id === composerListId ? null : list.id);
    setComposerValue((prev) => prev.replace(/(?:^|\s)@[^\s]*$/, " ").replace(/\s{2,}/g, " "));
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
    queueMicrotask(() => composerInputRef.current?.focus());
  }

  keyboardRef.current = {
    pathname,
    listsSorted,
    orderedVisibleTodos,
    optimisticTodos,
    selectedTodoId,
    canReorder,
    hasCompletedTodos,
    markAllIncomplete,
    moveCompletedToBottom,
    openCreateListModal: () => {
      setCreateListError(null);
      setNewListTitle("");
      createListModal.open();
    },
    setShowCompleted,
    setSelectedTodoId,
    startTodoTransition,
    addOptimistic,
    scheduleRefresh,
    onTodoDeleted: focusNextAfterDelete,
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
      return ["/all", ...k.listsSorted.map((l) => `/${l.slug}`)];
    };

    const escapeTodoDomId = (id: string) =>
      typeof globalThis.CSS !== "undefined" && typeof globalThis.CSS.escape === "function"
        ? globalThis.CSS.escape(id)
        : id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    const focusCheckboxForTodoId = (id: string) => {
      queueMicrotask(() => {
        const row = document.querySelector(`[data-todo-id="${escapeTodoDomId(id)}"]`);
        row?.querySelector<HTMLInputElement>(".todo-checkbox-squircle")?.focus();
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
      // #region agent log
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
        body: JSON.stringify({
          sessionId: "fd174b",
          runId: "shortcuts-audit-1",
          hypothesisId: "H1-keydown-not-reaching-handler",
          location: "today-client.tsx:onKeyDown",
          message: "Global keydown received",
          data: { key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (e.defaultPrevented) return;

      const typing = isTextTypingTarget(e.target);
      const k = keyboardRef.current;

      if (e.code === "Space" && e.target instanceof HTMLInputElement && e.target.type === "checkbox") {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        if (!e.altKey && e.key === "Enter" && document.activeElement === composerInputRef.current) {
          e.preventDefault();
          formRef.current?.requestSubmit();
          return;
        }
        return;
      }

      if (typing) {
        // #region agent log
        fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
          body: JSON.stringify({
            sessionId: "fd174b",
            runId: "shortcuts-audit-1",
            hypothesisId: "H2-shortcuts-blocked-by-typing-guard",
            location: "today-client.tsx:onKeyDown",
            message: "Shortcut ignored because typing target detected",
            data: { key: e.key, code: e.code },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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
        if (k.selectedTodoId) {
          k.setSelectedTodoId(null);
          e.preventDefault();
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        // #region agent log
        fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
          body: JSON.stringify({
            sessionId: "fd174b",
            runId: "shortcuts-audit-1",
            hypothesisId: "H3-event-dispatch-happens-but-modal-not-opening",
            location: "today-client.tsx:onKeyDown",
            message: "Dispatching keyboard shortcuts modal event",
            data: { eventName: YALP_OPEN_KEYBOARD_SHORTCUTS },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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
          // #region agent log
          fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
            body: JSON.stringify({
              sessionId: "fd174b",
              runId: "shortcuts-audit-1",
              hypothesisId: "H4-go-sequence-second-key-mapping-issue",
              location: "today-client.tsx:onKeyDown",
              message: "Go-sequence second key accepted",
              data: { key: kn },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          if (kn === "a") k.routerPush("/all");
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

      if (e.code === "KeyH") {
        e.preventDefault();
        k.setShowCompleted((v) => !v);
        return;
      }

      if (e.code === "KeyL") {
        e.preventDefault();
        k.openCreateListModal();
        return;
      }

      if (e.code === "KeyM") {
        e.preventDefault();
        k.markAllIncomplete();
        return;
      }

      if (e.code === "KeyB") {
        if (k.canReorder && k.hasCompletedTodos) {
          e.preventDefault();
          k.moveCompletedToBottom();
        }
        return;
      }

      if (e.code === "KeyJ" || e.code === "KeyK") {
        const ids = k.orderedVisibleTodos.map((t) => t.id);
        if (ids.length === 0) return;
        e.preventDefault();
        const cur = k.selectedTodoId ? ids.indexOf(k.selectedTodoId) : -1;
        let nextIdx: number;
        if (e.code === "KeyK") {
          nextIdx = cur <= 0 ? 0 : cur - 1;
        } else {
          nextIdx = cur < 0 ? 0 : Math.min(cur + 1, ids.length - 1);
        }
        const nextId = ids[nextIdx] ?? null;
        k.setSelectedTodoId(nextId);
        if (nextId) focusCheckboxForTodoId(nextId);
        return;
      }

      if (e.code === "Space") {
        const tid = k.selectedTodoId;
        if (!tid) return;
        const todo = k.optimisticTodos.find((t) => t.id === tid);
        if (!todo) return;
        e.preventDefault();
        const next = !todo.is_completed;
        k.startTodoTransition(async () => {
          k.addOptimistic({ type: "toggle", id: todo.id, completed: next });
          await toggleTodoAction(todo.id, next);
          k.scheduleRefresh();
        });
        return;
      }

      if (e.key === "Delete" && e.shiftKey) {
        const tid = k.selectedTodoId;
        if (!tid) return;
        const todo = k.optimisticTodos.find((t) => t.id === tid);
        if (!todo) return;
        e.preventDefault();
        k.startTodoTransition(async () => {
          k.addOptimistic({ type: "delete", id: todo.id });
          const res = await deleteTodoAction(todo.id);
          if ("error" in res) {
            k.addOptimistic({ type: "add", todo });
            toast.danger("Could not delete todo.", { timeout: 4500 });
            k.scheduleRefresh();
            return;
          }
          toast.success("Todo deleted.", { timeout: 2500 });
          k.setSelectedTodoId(null);
          k.onTodoDeleted?.(todo.id);
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
      <div className="mb-5 flex w-full items-center justify-between gap-3">
        {/* Mobile: select a list instead of horizontal chips. */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
          <Dropdown.Root>
            <Dropdown.Trigger>
              <span
                className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[12px] border border-[#e6e6e6] bg-white px-3 py-2 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                aria-label="Select list"
              >
                <span className="truncate">
                  {pathname === "/all"
                    ? `All • ${counts.all}`
                    : (() => {
                        const activeList = listsSorted.find((l) => isTabActiveForList(l.slug));
                        return activeList ? getListDisplayTitle(activeList) : "Select list";
                      })()}
                </span>
                <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.75} className="text-muted" />
              </span>
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom start">
              <Dropdown.Menu aria-label="Lists">
                <Dropdown.Item
                  textValue="All"
                  onAction={() => router.push("/all")}
                >
                  All <span className="mx-[2px] text-muted/70">•</span> {counts.all}
                </Dropdown.Item>
                {listsSorted.map((list) => (
                  <Dropdown.Item
                    key={list.id}
                    textValue={list.title}
                    onAction={() => router.push(listHref(list.slug))}
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
            aria-label="Add list"
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
        <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-[2px] sm:flex" aria-label="List filters">
          <DndContext
            id="yalp-dnd-list-tabs"
            sensors={listTabSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleListTabsDragEnd}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-[2px]">
              <Link
                href="/all"
                className={filterChipClass("/all")}
                aria-current={pathname === "/all" ? "page" : undefined}
                onMouseEnter={() => prefetchRoute("/all")}
                onFocus={() => prefetchRoute("/all")}
              >
                All{" "}
                {chipActive("/all") ? (
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
                    href={listHref(list.slug)}
                    chipClassName={filterChipClass(listHref(list.slug))}
                    isActive={isTabActiveForList(list.slug)}
                    count={counts.byListId[list.id] ?? 0}
                    displayTitle={getListDisplayTitle(list)}
                    onPrefetch={prefetchRoute}
                    onListContextMenu={(l, e) => {
                      setContextMenu({
                        listId: l.id,
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
                aria-label="Add list"
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

        <div className="flex-shrink-0">
          <Dropdown.Root>
            <Dropdown.Trigger>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[13px] font-medium text-muted hover:text-foreground">
                <HugeiconsIcon icon={SlidersHorizontalIcon} size={16} strokeWidth={1.75} className="text-current" />
                Display
              </span>
            </Dropdown.Trigger>
          <Dropdown.Popover
            placement="bottom end"
            style={{ width: "max-content", minWidth: "0px" }}
          >
            <Dropdown.Menu
              aria-label="Display options"
              className="w-fit max-w-max min-w-0"
            >
              <Dropdown.Item
                onAction={() => setShowCompleted((v) => !v)}
                textValue={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
              >
                {showCompleted ? "Hide completed tasks" : "Show completed tasks"}
              </Dropdown.Item>
              <Dropdown.Item
                onAction={markAllIncomplete}
                textValue="Mark all incomplete"
              >
                Mark all incomplete
              </Dropdown.Item>
              {canReorder ? (
                <Dropdown.Item
                  onAction={moveCompletedToBottom}
                  isDisabled={!hasCompletedTodos}
                  textValue="Move completed to bottom"
                >
                  Move completed to bottom
                </Dropdown.Item>
              ) : null}
            </Dropdown.Menu>
          </Dropdown.Popover>
          </Dropdown.Root>
        </div>
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
            aria-label="List actions"
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
                onAction={() => openRenameFlow(contextMenu.listId, contextMenu.slug, contextMenu.title)}
              >
                <div className="flex items-center gap-[8px]">
                  <Pencil size={16} />
                  <span>Rename</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item onAction={() => openDeleteFlow(contextMenu.listId, contextMenu.slug)}>
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
                <Modal.Heading>Create new list</Modal.Heading>
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
                    <Label>List name</Label>
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
                <Modal.Heading>Rename list</Modal.Heading>
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
                    <Label>List name</Label>
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

      <Modal.Root state={deleteTasksModal}>
        <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
          <span aria-hidden />
        </Modal.Trigger>
        <Modal.Backdrop>
          <Modal.Container size="md" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete list?</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3 text-[13px] leading-snug text-foreground">
                {deleteError ? (
                  <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                    {deleteError}
                  </p>
                ) : null}
                <p>
                  This list has <strong>{deleteTarget?.taskCount ?? 0}</strong> task
                  {(deleteTarget?.taskCount ?? 0) === 1 ? "" : "s"}. What should happen to
                  them?
                </p>
              </Modal.Body>
              <Modal.Footer className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  isDisabled={deleteBusy}
                  onPress={() => void confirmDeleteWithMode("move_tasks_to_unassigned")}
                >
                  Keep tasks in All
                </Button>
                <Button
                  variant="primary"
                  isDisabled={deleteBusy}
                  isPending={deleteBusy}
                  onPress={() => void confirmDeleteWithMode("delete_tasks")}
                >
                  Delete tasks with list
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <div className="mb-6">
        <form
          ref={formRef}
          key={composerListId ?? "none"}
          onSubmit={handleAddTodo}
          className="relative"
        >
          <div className="relative flex min-h-10 items-center gap-2 rounded-[16px] border border-[#e4e4e4] bg-white pr-3 shadow-[0_2px_10px_rgba(0,0,0,0.022),0_1px_2px_rgba(0,0,0,0.016)]">
            {composerTargetList ? (
              <button
                type="button"
                className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00b5e9]/12 px-2 py-1 font-title text-[12px] leading-4 font-medium text-[#00b5e9]"
                onClick={() => setComposerOverrideListId(null)}
                title="Clear selected list"
                aria-label={`Clear selected list ${composerTargetList.title}`}
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
              placeholder="New todo @list"
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
                  <p className="px-2.5 py-2 text-[12px] text-muted">No matching list</p>
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
        {visibleTodos.length === 0 ? (
          <ul className="flex flex-col">
            <li className="py-8 pl-6 text-center text-[13px] text-muted">No tasks yet.</li>
          </ul>
        ) : canReorder ? (
          <DndContext
            id="yalp-dnd-todos"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  "Use the drag handle. Press space to pick up, arrow keys to move, and space again to drop.",
              },
              announcements: {
                onDragStart({ active }) {
                  return `Picked up task ${String(active.id)}.`;
                },
                onDragOver({ active, over }) {
                  if (!over) return `Task ${String(active.id)} is over a drop zone.`;
                  return `Task ${String(active.id)} is over ${String(over.id)}.`;
                },
                onDragEnd({ active, over }) {
                  if (!over) return `Task ${String(active.id)} was dropped.`;
                  return `Task ${String(active.id)} moved before ${String(over.id)}.`;
                },
                onDragCancel({ active }) {
                  return `Drag cancelled for ${String(active.id)}.`;
                },
              },
            }}
          >
            <SortableContext items={renderedVisibleIds} strategy={verticalListSortingStrategy}>
              <ul className="relative flex flex-col overflow-visible">
                <AnimatePresence initial mode="popLayout">
                  {renderedOrderedTodos.map((todo, index) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      entranceDelay={getEntranceDelay(todo.id, index, renderedOrderedTodos.length)}
                      skipEntranceAnimation={skipListEntranceAnimations}
                      showDetailAction={!todo.parent_id}
                      {...todoRowHandlers}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </SortableContext>
            <DragOverlay>
              {draggedTodo ? (
                <div className="rounded-[12px] border border-[#e4e4e4] bg-white px-3 py-2 text-[13px] text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.15)]">
                  {draggedTodo.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial mode="popLayout">
              {renderedVisibleTodos.map((todo, index) => (
                <PresenceTodoRow
                  key={todo.id}
                  todo={todo}
                  entranceDelay={getEntranceDelay(todo.id, index, renderedVisibleTodos.length)}
                  skipEntranceAnimation={skipListEntranceAnimations}
                  showDetailAction={!todo.parent_id}
                  {...todoRowHandlers}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
        {hasMoreRendered ? (
          <div className="pt-3 text-center text-[12px] text-muted">Loading more tasks…</div>
        ) : null}
      </section>
      </div>
  );
}
