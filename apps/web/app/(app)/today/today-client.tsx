"use client";

import {
  addTodoAction,
  deleteTodoAction,
  duplicateTodoAction,
  moveTodoToListAction,
  reorderAllTodosAction,
  reorderTodosAction,
  toggleTodoAction,
  updateTodoTitleAction,
} from "@/app/(app)/today/actions";
import {
  createListAction,
  deleteListAction,
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
import { ChevronRight, Copy, Ellipsis, Folder, GripVertical, X } from "lucide-react";
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
  toast,
  TextField,
  useOverlayState,
} from "@heroui/react";
import {
  forwardRef,
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
import { usePathname, useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/useSubscription";
import { isClientDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type {
  ChangeEvent,
  ClipboardEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  MutableRefObject,
  Ref,
} from "react";

type TodoRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  list_id: string | null;
};

/** Listeden çıkış: hafif sola kayma + küçülme + soldurma (FM’de silme için yaygın pattern). */
const TODO_ROW_EXIT = {
  opacity: 0,
  x: -14,
  scale: 0.975,
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
};

/** Çok satırda toplam cascade süresini ~0,5s içinde tut; sıra değişince aynı id’ye aynı gecikme (ref ile). */
const LIST_ENTRANCE_INDEX_CAP = 40;
const LIST_ENTRANCE_TIME_BUDGET_SEC = 0.52;

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
  sectionHeaderLabel: string;
};

type SortableListTabChipProps = {
  list: UserListRow;
  href: string;
  chipClassName: string;
  isActive: boolean;
  count: number;
  onListContextMenu: (list: UserListRow, e: MouseEvent) => void;
};

function SortableListTabChip({
  list,
  href,
  chipClassName,
  isActive,
  count,
  onListContextMenu,
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
        <Link href={href} className={chipClassName} aria-current={isActive ? "page" : undefined}>
          {list.title}{" "}
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

type TodoOptimisticAction =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string }
  | { type: "add"; todo: TodoRow }
  | { type: "duplicateAfter"; afterId: string; todo: TodoRow }
  | { type: "moveList"; id: string; list_id: string | null }
  | { type: "reorder"; orderedIds: string[] }
  | { type: "updateTitle"; id: string; title: string };

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

/** Checkbox tamamlandığında: kısa ses + desteklenen cihazlarda vibrate (bu dosyada tutuluyor; ek webpack chunk hatası riskini azaltır). */
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioContext) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    sharedAudioContext = new Ctx();
  }
  return sharedAudioContext;
}

function playTodoCompleteChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.028);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.11, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  } catch {
    // autoplay / AudioContext
  }
}

function tryTodoCompleteVibrate(): void {
  if (typeof navigator === "undefined") return;
  const v = navigator.vibrate;
  if (typeof v !== "function") return;
  try {
    v.call(navigator, [12, 24, 10]);
  } catch {
    // ignore
  }
}

function feedbackTodoMarkedComplete(): void {
  playTodoCompleteChime();
  tryTodoCompleteVibrate();
}

function insertPlainTextIntoContentEditable(el: HTMLElement, text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  if (!el.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

type TodoRowMeasuredSortable = Pick<
  ReturnType<typeof useSortable>,
  "setNodeRef" | "setActivatorNodeRef" | "attributes" | "listeners"
> & {
  style: CSSProperties;
  isDragging?: boolean;
};

type TodoRowHandlers = {
  lists: { id: string; title: string }[];
  view?: "all" | "today" | "list";
  composerListId: string | null;
  setSelectedTodoId: (id: string) => void;
  isTodoPending: boolean;
  startTodoTransition: (cb: () => void | Promise<void>) => void;
  addOptimistic: (action: TodoOptimisticAction) => void;
  scheduleRefresh: () => void;
};

function TodoRowMeasured({
  todo,
  sortable,
  rootRef,
  entranceDelay,
  lists,
  view,
  composerListId,
  setSelectedTodoId,
  isTodoPending,
  startTodoTransition,
  addOptimistic,
  scheduleRefresh,
  skipEntranceAnimation,
}: {
  todo: TodoRow;
  rootRef?: Ref<HTMLLIElement | null>;
  sortable?: TodoRowMeasuredSortable;
  /** Liste / rota yüklemesinde sırayla görünüm (sn); sürükleme / yeniden sıra etkilenmez. */
  entranceDelay: number;
  /** Liste sekmesi / rota değişiminde animasyonu kapat (daha hızlı his). */
  skipEntranceAnimation?: boolean;
} & TodoRowHandlers) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const isTitleFocusedRef = useRef(false);
  const discardTitleEditRef = useRef(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoveSubmenuOpen, setIsMoveSubmenuOpen] = useState(false);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el || isTitleFocusedRef.current) return;
    if (el.textContent !== todo.title) {
      el.textContent = todo.title;
    }
  }, [todo.title]);

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

      setIsMultiline(height > 26);
    };

    compute();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [todo.title, todo.is_completed]);

  const commitTitleFromDom = useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    const next = (el.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (next === "") {
      el.textContent = todo.title;
      toast.danger("Title can't be empty.", { timeout: 2200 });
      return;
    }
    if (next === todo.title) return;
    const prevTitle = todo.title;
    startTodoTransition(async () => {
      addOptimistic({ type: "updateTitle", id: todo.id, title: next });
      const res = await updateTodoTitleAction(todo.id, next);
      if ("error" in res) {
        addOptimistic({ type: "updateTitle", id: todo.id, title: prevTitle });
        const cur = titleRef.current;
        if (cur) cur.textContent = prevTitle;
        toast.danger(res.error ?? "Could not update title.", { timeout: 4500 });
        scheduleRefresh();
        return;
      }
      scheduleRefresh();
    });
  }, [addOptimistic, scheduleRefresh, startTodoTransition, todo.id, todo.title]);

  const setNodeRefFromSortable = sortable?.setNodeRef;
  const mergedLiRef = useCallback(
    (node: HTMLLIElement | null) => {
      setNodeRefFromSortable?.(node);
      const r = rootRef;
      if (!r) return;
      if (typeof r === "function") r(node);
      else (r as MutableRefObject<HTMLLIElement | null>).current = node;
    },
    [setNodeRefFromSortable, rootRef],
  );

  const rowInnerClass = [
    "flex min-w-0 flex-1 gap-3 rounded-[16px] px-3 transition-colors duration-150 ease-out",
    isMenuOpen ? "bg-[#f4f4f4]" : "group-hover:bg-[#f4f4f4]",
    isMultiline ? "items-start py-2.5" : "items-center py-1.5",
  ].join(" ");

  const moveTargets = lists.filter((list) => list.id !== todo.list_id);

  return (
    <motion.li
      ref={mergedLiRef}
      layout={sortable ? !sortable.isDragging : true}
      initial={skipEntranceAnimation ? false : { opacity: 0, y: 10 }}
      animate={{
        opacity: sortable?.isDragging ? 0.85 : 1,
        y: 0,
      }}
      transition={{
        opacity: { duration: 0.2, delay: skipEntranceAnimation ? 0 : entranceDelay },
        y: {
          duration: 0.22,
          ease: [0.32, 0.72, 0, 1],
          delay: skipEntranceAnimation ? 0 : entranceDelay,
        },
        layout: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
      }}
      exit={TODO_ROW_EXIT}
      className="group relative mb-[2px] w-full list-none last:mb-0"
      style={sortable?.style}
      data-todo-row="1"
      data-todo-id={todo.id}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest('input[type="checkbox"]')) return;
        if (el.closest("button")) return;
        if (el.closest("[data-todo-title]")) return;
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
            className={["flex shrink-0", isMultiline ? "items-start" : "items-center"].join(" ")}
          >
            <input
              type="checkbox"
              className={[
                "todo-checkbox-squircle",
                isMultiline ? "self-start mt-[2px]" : "self-center",
              ].join(" ")}
              ref={checkboxRef}
              checked={!!todo.is_completed}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const checked = e.target.checked;
                if (checked) {
                  feedbackTodoMarkedComplete();
                }
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
            data-todo-title=""
            role="textbox"
            tabIndex={isTodoPending ? -1 : 0}
            contentEditable={!isTodoPending}
            suppressContentEditableWarning
            spellCheck={false}
            className={[
              "min-w-0 flex-1 cursor-text border-0 text-[14px] leading-5 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none",
              todo.is_completed ? "text-muted line-through" : "text-foreground",
            ].join(" ")}
            aria-label={`Edit task title: ${todo.title}`}
            aria-multiline="false"
            suppressHydrationWarning
            onFocus={() => {
              isTitleFocusedRef.current = true;
            }}
            onBlur={() => {
              isTitleFocusedRef.current = false;
              if (discardTitleEditRef.current) {
                discardTitleEditRef.current = false;
                return;
              }
              commitTitleFromDom();
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLSpanElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                discardTitleEditRef.current = true;
                e.currentTarget.textContent = todo.title;
                e.currentTarget.blur();
              }
            }}
            onPaste={(e: ClipboardEvent<HTMLSpanElement>) => {
              e.preventDefault();
              const text = e.clipboardData
                .getData("text/plain")
                .replace(/\r\n/g, "\n")
                .replace(/\n/g, " ");
              insertPlainTextIntoContentEditable(e.currentTarget, text);
            }}
          />

          <span
            className={[
              "flex shrink-0 items-center gap-0.5 -mr-[6px] opacity-0 transition-opacity group-hover:opacity-100",
              isMultiline ? "self-start -mt-1" : "",
            ].join(" ").trim()}
          >
            <Dropdown.Root
              onOpenChange={(open) => {
                setIsMenuOpen(open);
                if (!open) setIsMoveSubmenuOpen(false);
              }}
            >
              <Dropdown.Trigger
                className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-xl p-0 text-muted transition-colors hover:bg-[#eee] hover:text-foreground data-[hovered]:bg-[#eee] data-[hovered]:text-foreground data-[focused]:bg-[#eee] data-[focused]:text-foreground"
                aria-label={`More actions for ${todo.title}`}
                isDisabled={isTodoPending}
              >
                <Ellipsis size={16} />
              </Dropdown.Trigger>

              <Dropdown.Popover
                placement="bottom end"
                style={{ width: "max-content", minWidth: "0px", overflow: "visible" }}
              >
                <Dropdown.Menu
                  className="w-fit max-w-max min-w-0 overflow-visible"
                  aria-label={`Todo actions for ${todo.title}`}
                >
                  <Dropdown.Item
                    textValue="Duplicate"
                    onAction={() => {
                      setIsMoveSubmenuOpen(false);
                      startTodoTransition(async () => {
                        const duplicated: TodoRow = {
                          ...todo,
                          id: `optimistic-dup-${crypto.randomUUID()}`,
                        };
                        addOptimistic({ type: "duplicateAfter", afterId: todo.id, todo: duplicated });
                        const res = await duplicateTodoAction(todo.id);
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
                      onMouseEnter={() => setIsMoveSubmenuOpen(true)}
                      onMouseLeave={() => setIsMoveSubmenuOpen(false)}
                    >
                      <div className="flex w-full items-center justify-between gap-3 px-1 py-0.5">
                        <span className="inline-flex items-center gap-2">
                          <Folder size={14} />
                          <span>Move to list</span>
                        </span>
                        <ChevronRight size={14} className="ml-2 shrink-0 text-muted" />
                      </div>
                      {isMoveSubmenuOpen ? (
                        <div className="absolute top-0 left-[calc(100%-1px)] min-w-[200px] rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                          {moveTargets.length > 0 ? (
                            moveTargets.map((list) => (
                              <button
                                key={list.id}
                                type="button"
                                className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-[#f5f5f5]"
                                onClick={() => {
                                  setIsMoveSubmenuOpen(false);
                                  startTodoTransition(async () => {
                                    const prevListId = todo.list_id;
                                    addOptimistic({ type: "moveList", id: todo.id, list_id: list.id });
                                    if (view !== "all" && composerListId) {
                                      addOptimistic({ type: "delete", id: todo.id });
                                    }
                                    const res = await moveTodoToListAction(todo.id, list.id);
                                    if ("error" in res) {
                                      addOptimistic({ type: "moveList", id: todo.id, list_id: prevListId });
                                      toast.danger("Could not move todo.", { timeout: 4500 });
                                      scheduleRefresh();
                                      return;
                                    }
                                    toast.success(`Moved to ${list.title}.`, { timeout: 2200 });
                                    scheduleRefresh();
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
                      setIsMoveSubmenuOpen(false);
                      startTodoTransition(async () => {
                        try {
                          addOptimistic({ type: "delete", id: todo.id });
                          await deleteTodoAction(todo.id);
                          toast.success("Todo deleted.", { timeout: 2500 });
                        } catch {
                          addOptimistic({ type: "add", todo });
                          toast.danger("Could not delete todo.", { timeout: 4500 });
                        } finally {
                          scheduleRefresh();
                        }
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
          </span>
        </div>
      </div>
    </motion.li>
  );
}

const PresenceTodoRow = forwardRef<
  HTMLLIElement,
  { todo: TodoRow; entranceDelay: number; skipEntranceAnimation?: boolean } & TodoRowHandlers
>(function PresenceTodoRow({ todo, entranceDelay, skipEntranceAnimation, ...handlers }, ref) {
  return (
    <TodoRowMeasured
      todo={todo}
      rootRef={ref}
      entranceDelay={entranceDelay}
      skipEntranceAnimation={skipEntranceAnimation}
      {...handlers}
    />
  );
});

const SortableTodoItem = forwardRef<
  HTMLLIElement,
  { todo: TodoRow; entranceDelay: number; skipEntranceAnimation?: boolean } & TodoRowHandlers
>(function SortableTodoItem({ todo, entranceDelay, skipEntranceAnimation, ...handlers }, ref) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
      useSortable({ id: todo.id });

    return (
      <TodoRowMeasured
        todo={todo}
        rootRef={ref}
        entranceDelay={entranceDelay}
        skipEntranceAnimation={skipEntranceAnimation}
        {...handlers}
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
          },
        }}
      />
    );
});

export function TodayClient({
  initialTodos,
  composerListId,
  view,
}: TodayClientProps) {
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
  const [listTabOrderIds, setListTabOrderIds] = useState<string[] | null>(null);
  const listsSorted = useMemo(() => {
    if (!listTabOrderIds) return lists;
    const map = new Map(lists.map((l) => [l.id, l]));
    return listTabOrderIds.map((id) => map.get(id)).filter((x): x is UserListRow => x != null);
  }, [lists, listTabOrderIds]);

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
  const displayPrefKey = composerListId
    ? `yalp:display:showCompleted:${composerListId}`
    : "yalp:display:showCompleted:all";

  // Keep initial render deterministic for SSR hydration; apply persisted preference after mount.
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  // When navigating between lists, `TodayClient` can re-mount or re-use; keep
  // the per-list display preference consistent with the last selection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(displayPrefKey);
      if (raw === "false") setShowCompleted(false);
      else setShowCompleted(true);
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

  useEffect(() => {
    setComposerOverrideListId(null);
    setComposerValue("");
    setIsComposerListMenuOpen(false);
    setComposerListQuery("");
  }, [composerListId, pathname]);
  const [uiOrderIds, setUiOrderIds] = useState<string[] | null>(null);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [optimisticTodos, addOptimistic] = useOptimistic(
    initialTodos,
    applyTodoOptimistic,
  );
  const [isAddPending, startAddTransition] = useTransition();
  const [isTodoPending, startTodoTransition] = useTransition();
  const [, startListTabReorderTransition] = useTransition();
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

  const scheduleRefresh = useCallback(() => {
    queueMicrotask(() => router.refresh());
  }, [router]);

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

      // Toggle hide/show completed tasks.
      if (e.code === "KeyH") {
        e.preventDefault();
        setShowCompleted((v) => !v);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTodoId, view]);

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
    const nextLists = arrayMove(listsSorted, oldIndex, newIndex);
    const nextIds = nextLists.map((l) => l.id);
    setListTabOrderIds(nextIds);
    startListTabReorderTransition(async () => {
      const result = await reorderListsAction(nextIds);
      if (!result.ok) {
        toast.danger(result.error, { timeout: 4000 });
        setListTabOrderIds(null);
        return;
      }
      router.refresh();
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
                    : listsSorted.find((l) => isTabActiveForList(l.slug))?.title ?? "Select list"}
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
                    {list.title}
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
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[2px]">
              <Link href="/all" className={filterChipClass("/all")} aria-current={pathname === "/all" ? "page" : undefined}>
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
                    onListContextMenu={(l, e) => {
                      setContextMenu({
                        listId: l.id,
                        slug: l.slug,
                        title: l.title,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
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
              placeholder="New todo @list @2pm"
              disabled={isAddPending}
              value={composerValue}
              onChange={(e) => handleComposerChange(e.target.value)}
              className={[
                "min-w-0 flex-1 border-0 bg-transparent pt-2.5 pb-[11px] text-[13px] leading-5 text-foreground outline-none placeholder:text-muted",
                composerTargetList ? "pl-0" : "pl-4",
              ].join(" ")}
            />
            <kbd className="hidden shrink-0 items-center justify-center rounded border border-[#e6e6e6] bg-[#fafafa] px-1.5 py-1 font-sans text-[11px] font-medium leading-none text-muted sm:inline-flex">
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
                      {list.title}
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
            <SortableContext items={uiOrderIds ?? visibleIds} strategy={verticalListSortingStrategy}>
              <ul className="relative flex flex-col overflow-visible">
                <AnimatePresence initial mode="popLayout">
                  {orderedVisibleTodos.map((todo, index) => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      entranceDelay={getEntranceDelay(todo.id, index, orderedVisibleTodos.length)}
                      skipEntranceAnimation={skipListEntranceAnimations}
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
              {visibleTodos.map((todo, index) => (
                <PresenceTodoRow
                  key={todo.id}
                  todo={todo}
                  entranceDelay={getEntranceDelay(todo.id, index, visibleTodos.length)}
                  skipEntranceAnimation={skipListEntranceAnimations}
                  {...todoRowHandlers}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
      </div>
  );
}
