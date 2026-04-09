"use client";

import {
  addTodoAction,
  deleteTodoAction,
  duplicateTodoAction,
  moveTodoToListAction,
  reorderSubTodosAction,
  updateTodoTitleAction,
} from "@/app/(app)/today/actions";
import { useListsShell } from "@/app/(app)/lists-shell";
import {
  insertPlainTextIntoContentEditable,
  type TodoOptimisticAction,
  type TodoRow,
  type TodoRowHandlers,
  SortableTodoItem,
} from "@/app/(app)/today/todo-row";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { ChevronRight, Copy, Ellipsis, Folder, ArrowLeft } from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Dropdown } from "@heroui/react";
import { toast } from "@/lib/app-toast";
import { useSubscription } from "@/hooks/useSubscription";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useMemo,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import type { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

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

export type TodoDetailParent = {
  id: string;
  title: string;
  is_completed: boolean | null;
  list_id: string | null;
};

export function TodoDetailClient({
  backHref,
  initialParent,
  initialSubTodos,
}: {
  backHref: string;
  initialParent: TodoDetailParent;
  initialSubTodos: TodoRow[];
}) {
  const router = useRouter();
  const { lists } = useListsShell();
  const subscription = useSubscription();

  const [parent, setParent] = useState(initialParent);
  const [baseSubs, setBaseSubs] = useState(initialSubTodos);
  const [optimisticSubs, addOptimistic] = useOptimistic(baseSubs, applyTodoOptimistic);
  const [isTodoPending, startTodoTransition] = useTransition();
  const [, startAddTransition] = useTransition();
  const [, setSelectedTodoId] = useState<string | null>(null);

  const [uiOrderIds, setUiOrderIds] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const preDragOrderRef = useRef<string[] | null>(null);
  const reorderQueuedRef = useRef<{ orderedIds: string[]; rollback: string[] } | null>(null);
  const reorderInFlightRef = useRef(false);

  const titleRef = useRef<HTMLSpanElement>(null);
  const isTitleFocusedRef = useRef(false);
  const discardTitleRef = useRef(false);
  const composeRef = useRef<HTMLSpanElement>(null);
  const [composeFocused, setComposeFocused] = useState(false);
  const [composeEmpty, setComposeEmpty] = useState(true);

  useEffect(() => {
    setParent(initialParent);
  }, [initialParent]);

  useEffect(() => {
    setBaseSubs(initialSubTodos);
  }, [initialSubTodos]);

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

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el || isTitleFocusedRef.current) return;
    if (el.textContent !== parent.title) el.textContent = parent.title;
  }, [parent.title]);

  const commitParentTitle = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    const next = (el.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (next === "") {
      el.textContent = parent.title;
      toast.danger("Title can't be empty.", { timeout: 2200 });
      return;
    }
    if (next === parent.title) return;
    const prev = parent.title;
    startTodoTransition(async () => {
      setParent((p) => ({ ...p, title: next }));
      const res = await updateTodoTitleAction(parent.id, next);
      if ("error" in res) {
        setParent((p) => ({ ...p, title: prev }));
        const cur = titleRef.current;
        if (cur) cur.textContent = prev;
        toast.danger(res.error ?? "Could not update title.", { timeout: 4500 });
        scheduleRefresh();
        return;
      }
      scheduleRefresh();
    });
  }, [parent.id, parent.title, scheduleRefresh, startTodoTransition]);

  const listView: "all" | "list" = parent.list_id ? "list" : "all";

  const todoRowHandlers = useMemo<TodoRowHandlers>(
    () => ({
      lists: lists.map((l) => ({ id: l.id, title: l.title })),
      view: listView,
      composerListId: parent.list_id,
      setSelectedTodoId,
      isTodoPending,
      startTodoTransition,
      addOptimistic,
      scheduleRefresh,
    }),
    [
      lists,
      listView,
      parent.list_id,
      isTodoPending,
      startTodoTransition,
      addOptimistic,
      scheduleRefresh,
    ],
  );

  const visibleSubs = optimisticSubs;
  const visibleIds = useMemo(() => visibleSubs.map((t) => t.id), [visibleSubs]);
  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const orderedVisible =
    uiOrderIds && uiOrderIds.length === visibleIds.length
      ? reorderTodosByIds(visibleSubs, uiOrderIds)
      : visibleSubs;

  useEffect(() => {
    if (!uiOrderIds) return;
    if (uiOrderIds.length !== visibleIds.length) {
      setUiOrderIds(null);
      return;
    }
    for (const id of uiOrderIds) {
      if (!visibleSet.has(id)) {
        setUiOrderIds(null);
        return;
      }
    }
  }, [uiOrderIds, visibleIds.length, visibleSet]);

  async function persistSubReorder(orderedIds: string[], rollback: string[]) {
    try {
      await reorderSubTodosAction(parent.id, orderedIds);
      scheduleRefresh();
    } catch {
      setUiOrderIds(rollback);
      toast.danger("Could not save the new order.", { timeout: 4000 });
    }
  }

  async function reorderWorker() {
    if (reorderInFlightRef.current) return;
    reorderInFlightRef.current = true;
    try {
      while (reorderQueuedRef.current) {
        const job = reorderQueuedRef.current;
        reorderQueuedRef.current = null;
        if (!job) continue;
        await persistSubReorder(job.orderedIds, job.rollback);
      }
    } finally {
      reorderInFlightRef.current = false;
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(e: DragStartEvent) {
    const cur = uiOrderIds ?? visibleIds;
    preDragOrderRef.current = cur;
    setDraggingId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const previous = preDragOrderRef.current ?? (uiOrderIds ?? visibleIds);
    const current = uiOrderIds ?? visibleIds;
    const oldIndex = current.indexOf(String(active.id));
    const newIndex = current.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(current, oldIndex, newIndex);
    setUiOrderIds(next);
    const fullIds = optimisticSubs.map((t) => t.id);
    const merged = mergeVisibleOrderIntoFull(fullIds, next, visibleSet);
    reorderQueuedRef.current = { orderedIds: merged, rollback: previous };
    if (!reorderInFlightRef.current) void reorderWorker();
  }

  function handleDragCancel() {
    setDraggingId(null);
    if (preDragOrderRef.current) setUiOrderIds(preDragOrderRef.current);
  }

  const draggedTodo = draggingId ? orderedVisible.find((t) => t.id === draggingId) ?? null : null;

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const moveTargets = lists.filter((l) => l.id !== parent.list_id);

  function slugForListId(listId: string | null): string | null {
    if (!listId) return null;
    return lists.find((l) => l.id === listId)?.slug ?? null;
  }

  function submitSubCompose() {
    const el = composeRef.current;
    if (!el) return;
    const title = (el.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) return;

    if (!subscription.isPro && !subscription.canAddTodo(parent.list_id)) {
      const isInbox = !parent.list_id;
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
    startAddTransition(async () => {
      addOptimistic({
        type: "add",
        todo: {
          id: tempId,
          title,
          is_completed: false,
          list_id: parent.list_id,
          parent_id: parent.id,
        },
      });
      el.textContent = "";
      setComposeEmpty(true);
      const fd = new FormData();
      fd.set("title", title);
      fd.set("parent_id", parent.id);
      const res = await addTodoAction(null, fd);
      if (res?.error) {
        addOptimistic({ type: "delete", id: tempId });
        if (el.textContent === "") {
          el.textContent = title;
          setComposeEmpty(false);
        }
        toast.danger(res.error, { timeout: 4500 });
        if (!subscription.isPro && /upgrade|limit|full/i.test(res.error)) {
          subscription.openPaymentModal({ dismissible: false });
        }
      }
      scheduleRefresh();
    });
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 text-foreground">
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <Link
          href={backHref}
          style={{ borderRadius: 10 }}
          className="group inline-flex h-7 max-h-7 shrink-0 items-center gap-0 overflow-hidden py-0 pl-1.5 pr-2 text-muted transition-[gap,colors] duration-200 hover:bg-[#eee] hover:text-foreground group-hover:gap-2.5"
          aria-label="Back to list"
        >
          <ArrowLeft size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-[max-width,opacity,margin] duration-200 ease-out group-hover:ml-[2px] group-hover:max-w-[4.5rem] group-hover:opacity-100">
            Back
          </span>
        </Link>
        <Dropdown.Root
          onOpenChange={(open) => {
            if (!open) setIsMoveOpen(false);
          }}
        >
          <Dropdown.Trigger
            className="inline-flex h-7 w-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-lg p-0 text-muted transition-colors hover:bg-[#eee] hover:text-foreground data-[hovered]:bg-[#eee] data-[hovered]:text-foreground"
            aria-label={`More actions for ${parent.title}`}
            isDisabled={isTodoPending}
          >
            <Ellipsis size={16} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" style={{ width: "max-content", minWidth: "0px", overflow: "visible" }}>
            <Dropdown.Menu
              className="w-fit max-w-max min-w-0 overflow-visible"
              aria-label={`Todo actions for ${parent.title}`}
            >
              <Dropdown.Item
                textValue="Duplicate"
                onAction={() => {
                  setIsMoveOpen(false);
                  startTodoTransition(async () => {
                    const res = await duplicateTodoAction(parent.id);
                    if ("error" in res) {
                      toast.danger("Could not duplicate todo.", { timeout: 4500 });
                      scheduleRefresh();
                      return;
                    }
                    toast.success("Todo duplicated.", { timeout: 2200 });
                    scheduleRefresh();
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Copy size={14} />
                  <span>Duplicate</span>
                </span>
              </Dropdown.Item>
              <Dropdown.Item textValue="Move to list">
                <div
                  className="relative -mx-1 overflow-visible"
                  onMouseEnter={() => setIsMoveOpen(true)}
                  onMouseLeave={() => setIsMoveOpen(false)}
                >
                  <div className="flex w-full items-center justify-between gap-3 px-1 py-0.5">
                    <span className="inline-flex items-center gap-2">
                      <Folder size={14} />
                      <span>Move to list</span>
                    </span>
                    <ChevronRight size={14} className="ml-2 shrink-0 text-muted" />
                  </div>
                  {isMoveOpen ? (
                    <div className="absolute top-0 left-[calc(100%-1px)] z-50 min-w-[200px] rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                      {moveTargets.length > 0 ? (
                        moveTargets.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-[#f5f5f5]"
                            onClick={() => {
                              setIsMoveOpen(false);
                              startTodoTransition(async () => {
                                const res = await moveTodoToListAction(parent.id, list.id);
                                if ("error" in res) {
                                  toast.danger("Could not move todo.", { timeout: 4500 });
                                  scheduleRefresh();
                                  return;
                                }
                                toast.success(`Moved to ${list.title}.`, { timeout: 2200 });
                                const slug = slugForListId(list.id);
                                if (slug) router.push(`/${slug}`);
                                else router.push("/all");
                              });
                            }}
                          >
                            {list.title}
                          </button>
                        ))
                      ) : (
                        <p className="px-2.5 py-2 text-[12px] text-muted">No other lists</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                textValue="Delete"
                className="text-[color:var(--color-danger)]"
                onAction={() => {
                  setIsMoveOpen(false);
                  startTodoTransition(async () => {
                    const res = await deleteTodoAction(parent.id);
                    if ("error" in res) {
                      toast.danger("Could not delete todo.", { timeout: 4500 });
                      scheduleRefresh();
                      return;
                    }
                    toast.success("Todo deleted.", { timeout: 2500 });
                    router.replace(backHref);
                    scheduleRefresh();
                  });
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.75} />
                  <span>Delete</span>
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>

      <div className="w-full min-w-0">
        <span
          ref={titleRef}
          data-todo-title=""
          role="textbox"
          tabIndex={isTodoPending ? -1 : 0}
          contentEditable={!isTodoPending}
          suppressContentEditableWarning
          spellCheck={false}
          suppressHydrationWarning
          className={[
            "block w-full min-w-0 max-w-full cursor-text border-0 text-[22px] font-semibold leading-7 shadow-none outline-none ring-0 focus:outline-none focus:ring-0",
            parent.is_completed ? "text-muted line-through" : "text-foreground",
          ].join(" ")}
          aria-label={`Edit task title: ${parent.title}`}
          onFocus={() => {
            isTitleFocusedRef.current = true;
          }}
          onBlur={() => {
            isTitleFocusedRef.current = false;
            if (discardTitleRef.current) {
              discardTitleRef.current = false;
              return;
            }
            commitParentTitle();
          }}
          onKeyDown={(e: ReactKeyboardEvent<HTMLSpanElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              discardTitleRef.current = true;
              e.currentTarget.textContent = parent.title;
              e.currentTarget.blur();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData
              .getData("text/plain")
              .replace(/\r\n/g, "\n")
              .replace(/\n/g, " ");
            insertPlainTextIntoContentEditable(e.currentTarget, text);
          }}
        />
      </div>

      <div className="h-px w-full bg-[#ececec]" role="separator" />

      <div className="flex w-full min-w-0 flex-col gap-0">
        <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">Sub-todos</p>
        <div className="group/compose relative mb-[2px] w-full min-w-0">
          <div
            className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-[16px] px-3 transition-colors duration-150 ease-out group-hover/compose:bg-[#f4f4f4]"
          >
            <span className="flex shrink-0 items-center">
              <input
                type="checkbox"
                className="todo-checkbox-squircle pointer-events-none opacity-[0.38]"
                tabIndex={-1}
                disabled
                aria-hidden
                checked={false}
                onChange={() => {}}
              />
            </span>
            <div className="relative flex min-h-9 min-w-0 flex-1 items-center">
              {!composeFocused && composeEmpty ? (
                <span className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 select-none text-[14px] leading-5 text-muted">
                  Add a sub-todo
                </span>
              ) : null}
              <span
                ref={composeRef}
                role="textbox"
                tabIndex={0}
                contentEditable
                suppressContentEditableWarning
                className="relative z-10 block min-h-5 w-full min-w-0 cursor-text border-0 bg-transparent text-[14px] leading-5 text-foreground shadow-none outline-none ring-0 focus:outline-none focus:ring-0"
                onFocus={() => setComposeFocused(true)}
                onInput={() => {
                  const t = composeRef.current?.textContent?.replace(/\s/g, "") ?? "";
                  setComposeEmpty(t.length === 0);
                }}
                onBlur={() => {
                  setComposeFocused(false);
                }}
                onKeyDown={(e: ReactKeyboardEvent<HTMLSpanElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSubCompose();
                  }
                }}
                onPaste={(e: ClipboardEvent<HTMLSpanElement>) => {
                  e.preventDefault();
                  const text = e.clipboardData
                    .getData("text/plain")
                    .replace(/\r\n/g, "\n")
                    .replace(/\n/g, " ");
                  if (composeRef.current) insertPlainTextIntoContentEditable(composeRef.current, text);
                  const t = composeRef.current?.textContent?.replace(/\s/g, "") ?? "";
                  setComposeEmpty(t.length === 0);
                }}
              />
            </div>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
            <ul className="m-0 flex w-full min-w-0 flex-col p-0">
              <AnimatePresence initial={false} mode="popLayout">
                {orderedVisible.map((todo, index) => (
                  <SortableTodoItem
                    key={todo.id}
                    todo={{ ...todo, parent_id: parent.id }}
                    entranceDelay={Math.min(index, 24) * 0.028}
                    showDetailAction={false}
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
      </div>
    </div>
  );
}
