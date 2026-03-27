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
  type DeleteListMode,
} from "@/app/(app)/lists/actions";
import { useListsShell } from "@/app/(app)/lists-shell";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  PlusSignIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { GripVertical } from "lucide-react";
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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
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
  toast,
  TextField,
  useOverlayState,
} from "@heroui/react";
import {
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useMemo,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const SHOULD_DEBUG_INGEST =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_INGEST === "true";

type TodoRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
};

export type TodayClientProps = {
  initialTodos: TodoRow[];
  /** Reserved for future view-specific behavior (All / Today / custom list). */
  view?: "all" | "today" | "list";
  composerListId: string | null;
  sectionHeaderLabel: string;
};

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

type TodoOptimisticAction =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string }
  | { type: "add"; todo: TodoRow }
  | { type: "reorder"; orderedIds: string[] };

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

function applyTodoOptimistic(state: TodoRow[], action: TodoOptimisticAction): TodoRow[] {
  switch (action.type) {
    case "toggle":
      return state.map((t) =>
        t.id === action.id ? { ...t, is_completed: action.completed } : t,
      );
    case "delete":
      return state.filter((t) => t.id !== action.id);
    case "add":
      return [...state, action.todo];
    case "reorder":
      return reorderTodosByIds(state, action.orderedIds);
  }
}

export function TodayClient({
  initialTodos,
  composerListId,
}: TodayClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { lists, counts } = useListsShell();
  const formRef = useRef<HTMLFormElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const displayPrefKey = composerListId
    ? `yalp:display:showCompleted:${composerListId}`
    : "yalp:display:showCompleted:all";

  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(displayPrefKey);
      if (raw === "false") return false;
      if (raw === "true") return true;
    } catch {
      // Ignore localStorage failures (private mode, blocked storage, etc.)
    }
    return true;
  });

  // When navigating between lists, `TodayClient` can re-mount or re-use; keep
  // the per-list display preference consistent with the last selection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(displayPrefKey);
      setShowCompleted(raw === "false" ? false : true);
    } catch {
      setShowCompleted(true);
    }
  }, [displayPrefKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(displayPrefKey, String(showCompleted));
    } catch {
      // Ignore write failures.
    }
  }, [displayPrefKey, showCompleted]);
  const [uiOrderIds, setUiOrderIds] = useState<string[] | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [optimisticTodos, addOptimistic] = useOptimistic(
    initialTodos,
    applyTodoOptimistic,
  );
  const [isAddPending, startAddTransition] = useTransition();
  const [isTodoPending, startTodoTransition] = useTransition();
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const latestOrderRef = useRef<string[] | null>(null);

  const createListModal = useOverlayState();
  const deleteTasksModal = useOverlayState();
  const [newListTitle, setNewListTitle] = useState("");
  const [createListError, setCreateListError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  function scheduleRefresh() {
    queueMicrotask(() => router.refresh());
  }

  useEffect(() => {
    if (!reorderError) return;
    toast.danger(reorderError, { timeout: 4000 });
    setReorderError(null);
  }, [reorderError]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isTextTypingTarget(e.target)) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        composerInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTodoId]);

  const chipActive = (href: string) => pathname === href;

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

  function TodoRowMeasured({
    todo,
    sortable,
  }: {
    todo: TodoRow;
    sortable?: Pick<
      ReturnType<typeof useSortable>,
      "setNodeRef" | "setActivatorNodeRef" | "attributes" | "listeners"
    > & {
      style: React.CSSProperties;
      isDragging?: boolean;
    };
  }) {
    const titleRef = useRef<HTMLSpanElement>(null);
    const checkboxRef = useRef<HTMLInputElement>(null);
    const actionsRef = useRef<HTMLSpanElement>(null);
    const [isMultiline, setIsMultiline] = useState(false);

    useLayoutEffect(() => {
      const el = titleRef.current;
      if (!el) return;

      const compute = () => {
        const style = window.getComputedStyle(el);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = el.getBoundingClientRect().height;

        if (Number.isFinite(lineHeight) && lineHeight > 0) {
          setIsMultiline(height > lineHeight * 1.6);
          return;
        }

        // Fallback: 2+ satır neredeyse her durumda daha yüksek olacaktır.
        setIsMultiline(height > 26);
      };

      compute();

      if (typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => compute());
      ro.observe(el);
      return () => ro.disconnect();
    }, [todo.title, todo.is_completed]);

    const rowInnerClass = [
      "flex min-w-0 flex-1 gap-3 rounded-[16px] px-3 transition-colors duration-150 ease-out",
      "group-hover:bg-[#f4f4f4]",
      isMultiline ? "items-start py-2.5" : "items-center py-1.5",
    ].join(" ");

    return (
      <li
        ref={sortable?.setNodeRef}
        className="group relative w-full list-none"
        style={sortable?.style}
        data-todo-row="1"
        data-todo-id={todo.id}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest('input[type="checkbox"]')) return;
          if (el.closest("button")) return;
          setSelectedTodoId(todo.id);
        }}
      >
        <div className="relative flex min-w-0 flex-1">
          {sortable ? (
            <button
              type="button"
              ref={sortable.setActivatorNodeRef}
              {...sortable.attributes}
              {...(sortable.listeners ?? {})}
              aria-describedby={undefined}
              className={[
                "absolute z-10 inline-flex min-h-9 min-w-9 cursor-grab items-center justify-center rounded-[8px] p-0 text-muted/70 transition-opacity duration-150 ease-out",
                "left-0 -translate-x-[calc(100%-2px)]",
                isMultiline ? "top-[10px] translate-y-0" : "top-1/2 -translate-y-1/2",
                sortable.isDragging
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:pointer-events-auto focus-visible:opacity-100",
                "hover:text-foreground/80 active:cursor-grabbing",
              ].join(" ")}
              aria-label={`Reorder ${todo.title}`}
            >
              <GripVertical size={16} strokeWidth={2} className="text-current" />
            </button>
          ) : null}

          <div className={rowInnerClass}>
            <span
              className={[
                "flex shrink-0",
                isMultiline ? "items-start" : "items-center",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className={[
                  "todo-checkbox-squircle",
                  isMultiline ? "self-start mt-[2px]" : "self-center",
                ].join(" ")}
                ref={checkboxRef}
                checked={!!todo.is_completed}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const checked = e.target.checked;
                  startTodoTransition(async () => {
                    addOptimistic({ type: "toggle", id: todo.id, completed: checked });
                    await toggleTodoAction(todo.id, checked);
                    scheduleRefresh();
                  });
                }}
                aria-label={
                  todo.is_completed
                    ? `Mark incomplete: ${todo.title}`
                    : `Mark complete: ${todo.title}`
                }
              />
            </span>

            <span
              ref={titleRef}
              className={
                todo.is_completed
                  ? "min-w-0 flex-1 text-[14px] leading-5 text-muted line-through"
                  : "min-w-0 flex-1 text-[14px] leading-5 text-foreground"
              }
            >
              {todo.title}
            </span>

            <span
              ref={actionsRef}
              className={[
                "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                isMultiline ? "self-start -mt-1" : "",
              ].join(" ").trim()}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-7 min-w-7 p-0 text-muted hover:text-foreground"
                aria-label={`Delete ${todo.title}`}
                onPress={() => {
                  startTodoTransition(async () => {
                    addOptimistic({ type: "delete", id: todo.id });
                    await deleteTodoAction(todo.id);
                    scheduleRefresh();
                  });
                }}
                isDisabled={isTodoPending}
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.75} />
              </Button>
            </span>
          </div>
        </div>
      </li>
    );
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

  async function persistReorderIfPossible(orderedIds: string[], rollbackOrder: string[]) {
    if (orderedIds.length === 0) return;
    // #region debug-log:persistReorderIfPossible
    if (SHOULD_DEBUG_INGEST) {
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "e410d4",
        },
        body: JSON.stringify({
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
        }),
      }).catch(() => {});
    }
    // #endregion
    // Merge: if completed are hidden, only the visible subset was reordered.
    // Preserve the relative placement of hidden items by reusing the subset slots.
    const fullIds = optimisticTodos.map((t) => t.id);
    const visibleSet = visibleIdSet;

    const mergedIds: string[] = [];
    let i = 0;
    for (const id of fullIds) {
      if (visibleSet.has(id)) {
        mergedIds.push(orderedIds[i] ?? id);
        i += 1;
      } else {
        mergedIds.push(id);
      }
    }

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
    return slug === "today" ? "/today" : `/${slug}`;
  }

  function isTabActiveForList(slug: string) {
    if (slug === "today") return pathname === "/today";
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

  function afterListDeleted(slug: string) {
    deleteTasksModal.close();
    setDeleteTarget(null);
    setDeleteError(null);
    const path = slug === "today" ? "/today" : `/${slug}`;
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
      afterListDeleted(deleteTarget.slug);
    } else {
      setDeleteError(r.error);
    }
  }

  function handleAddTodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    const titleInput = formRef.current?.querySelector<HTMLInputElement>('input[name="title"]');
    const title = (titleInput?.value ?? "").trim();
    if (!title) {
      setAddError("Enter a task title.");
      return;
    }
    const tempId = `optimistic-${crypto.randomUUID()}`;
    if (titleInput) titleInput.value = "";
    const fd = new FormData();
    fd.set("title", title);
    if (composerListId) fd.set("list_id", composerListId);
    startAddTransition(async () => {
      addOptimistic({
        type: "add",
        todo: { id: tempId, title, is_completed: false },
      });
      const result = await addTodoAction(null, fd);
      if (result?.error) {
        setAddError(result.error);
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

  function SortableTodoItem({ todo }: { todo: TodoRow }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
      useSortable({ id: todo.id });

    return (
      <TodoRowMeasured
        todo={todo}
        sortable={{
          setNodeRef,
          setActivatorNodeRef,
          attributes,
          listeners,
          isDragging,
          style: {
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 20 : undefined,
            opacity: isDragging ? 0.85 : 1,
          },
        }}
      />
    );
  }

  return (
    <div className="today-shell flex w-full flex-col text-foreground">
      {listDeleteInlineError ? (
        <p className="mb-2 text-sm text-[color:var(--color-danger)]" role="alert">
          {listDeleteInlineError}
        </p>
      ) : null}
      <div className="mb-5 flex w-full items-center justify-between gap-3">
        <nav
          className="flex flex-1 flex-wrap items-center gap-[2px] min-w-0"
          aria-label="List filters"
        >
          <Link
            href="/all"
            className={filterChipClass("/all")}
            aria-current={pathname === "/all" ? "page" : undefined}
          >
            All{" "}
            {chipActive("/all") ? (
              <>
                <span className="mx-[2px] text-muted/70">•</span> {counts.all}
              </>
            ) : null}
          </Link>
          {lists.map((list) => (
            <div
              key={list.id}
              className="inline-flex"
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  listId: list.id,
                  slug: list.slug,
                  title: list.title,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            >
              <Link
                href={listHref(list.slug)}
                className={filterChipClass(listHref(list.slug))}
                aria-current={isTabActiveForList(list.slug) ? "page" : undefined}
              >
                {list.title}{" "}
                {isTabActiveForList(list.slug) ? (
                  <>
                    <span className="mx-[2px] text-muted/70">•</span> {counts.byListId[list.id] ?? 0}
                  </>
                ) : null}
              </Link>
            </div>
          ))}
          <button
            type="button"
            className="ml-0.5 rounded-[12px] p-1 text-muted hover:bg-[#f3f3f3] hover:text-foreground"
            aria-label="Add list"
            onClick={() => {
              setCreateListError(null);
              setNewListTitle("");
              createListModal.open();
            }}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="text-current" />
          </button>
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
          {composerListId ? <input type="hidden" name="list_id" value={composerListId} /> : null}
          <div className="flex min-h-10 items-center gap-4 rounded-[16px] border border-[#e4e4e4] bg-white pr-4 shadow-[0_2px_10px_rgba(0,0,0,0.022),0_1px_2px_rgba(0,0,0,0.016)]">
            <input
              ref={composerInputRef}
              name="title"
              type="text"
              autoComplete="off"
              placeholder="New todo @list @2pm"
              disabled={isAddPending}
              className="min-w-0 flex-1 border-0 bg-transparent pt-2.5 pb-3 pl-4 text-[13px] leading-5 text-foreground outline-none placeholder:text-muted"
            />
            <kbd className="hidden shrink-0 rounded border border-[#e6e6e6] bg-[#fafafa] px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted sm:inline-block">
              N
            </kbd>
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
            <SortableContext items={uiOrderIds ?? visibleIds} strategy={verticalListSortingStrategy}>
              <ul className="relative flex flex-col overflow-visible">
                {orderedVisibleTodos.map((todo) => (
                  <SortableTodoItem key={todo.id} todo={todo} />
                ))}
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
            {visibleTodos.map((todo) => (
              <TodoRowMeasured key={todo.id} todo={todo} />
            ))}
          </ul>
        )}
      </section>
      </div>
  );
}
