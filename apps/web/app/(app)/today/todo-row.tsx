"use client";

import {
  deleteTodoAction,
  duplicateTodoAction,
  moveTodoToListAction,
  toggleTodoAction,
  updateTodoTitleAction,
} from "@/app/(app)/today/actions";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRightBigIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ChevronRight, Copy, Ellipsis, Folder, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dropdown } from "@heroui/react";
import { toast } from "@/lib/app-toast";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type Ref,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export type TodoRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  list_id: string | null;
  parent_id?: string | null;
  sub_todo_completed_count?: number;
  sub_todo_total_count?: number;
};

export type TodoOptimisticAction =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string }
  | { type: "add"; todo: TodoRow }
  | { type: "duplicateAfter"; afterId: string; todo: TodoRow }
  | { type: "moveList"; id: string; list_id: string | null }
  | { type: "reorder"; orderedIds: string[] }
  | { type: "updateTitle"; id: string; title: string };

/** Listeden çıkış: hafif sola kayma + küçülme + soldurma (FM’de silme için yaygın pattern). */
export const TODO_ROW_EXIT = {
  opacity: 0,
  x: -14,
  scale: 0.975,
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
};

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

export function insertPlainTextIntoContentEditable(el: HTMLElement, text: string): void {
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

export type TodoRowMeasuredSortable = Pick<
  ReturnType<typeof useSortable>,
  "setNodeRef" | "setActivatorNodeRef" | "attributes" | "listeners"
> & {
  style: CSSProperties;
  isDragging?: boolean;
};

export type TodoRowHandlers = {
  lists: { id: string; title: string }[];
  view?: "all" | "today" | "list";
  composerListId: string | null;
  setSelectedTodoId: (id: string) => void;
  isTodoPending: boolean;
  startTodoTransition: (cb: () => void | Promise<void>) => void;
  addOptimistic: (action: TodoOptimisticAction) => void;
  scheduleRefresh: () => void;
  onTodoDeleted?: (deletedId: string) => void;
};

export function TodoRowMeasured({
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
  onTodoDeleted,
  skipEntranceAnimation,
  showDetailAction = true,
}: {
  todo: TodoRow;
  rootRef?: Ref<HTMLLIElement | null>;
  sortable?: TodoRowMeasuredSortable;
  entranceDelay: number;
  skipEntranceAnimation?: boolean;
  /** Ana todo satırında `/todo/:id` kısayolu; sub-todo’larda kapalı. */
  showDetailAction?: boolean;
} & TodoRowHandlers) {
  const pathname = usePathname();
  const titleRef = useRef<HTMLSpanElement>(null);
  const isTitleFocusedRef = useRef(false);
  const discardTitleEditRef = useRef(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoveSubmenuOpen, setIsMoveSubmenuOpen] = useState(false);
  const [detailOpenTooltipVisible, setDetailOpenTooltipVisible] = useState(false);
  const detailOpenTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDetailOpenTooltipTimer = useCallback(() => {
    if (detailOpenTooltipTimerRef.current !== null) {
      clearTimeout(detailOpenTooltipTimerRef.current);
      detailOpenTooltipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearDetailOpenTooltipTimer();
    };
  }, [clearDetailOpenTooltipTimer]);

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
    "relative flex min-w-0 flex-1 gap-3 rounded-[16px] px-3 transition-colors duration-150 ease-out",
    isMenuOpen ? "bg-[#f4f4f4]" : "group-hover:bg-[#f4f4f4]",
    isMultiline ? "items-start py-2.5" : "items-center py-1.5",
  ].join(" ");

  const moveTargets = lists.filter((list) => list.id !== todo.list_id);
  const subTodoTotal = todo.sub_todo_total_count ?? 0;
  const subTodoCompleted = todo.sub_todo_completed_count ?? 0;
  const showSubTodoProgress = showDetailAction && !todo.parent_id && subTodoTotal > 0;
  const detailHref = pathname ? `/todo/${todo.id}?from=${encodeURIComponent(pathname)}` : `/todo/${todo.id}`;

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
        if (el.closest("a")) return;
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
              "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 shrink-0 text-[12px] tabular-nums text-muted transition-opacity duration-150",
              isMenuOpen ? "opacity-0" : "opacity-100 group-hover:opacity-0",
              showSubTodoProgress ? "" : "hidden",
            ].join(" ").trim()}
            aria-hidden={!showSubTodoProgress}
          >
            {subTodoCompleted}/{subTodoTotal}
          </span>

          <span
            className={[
              "flex shrink-0 items-center gap-0.5 -mr-[6px] transition-opacity",
              isMultiline ? "self-start -mt-1" : "",
              isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            ].join(" ").trim()}
          >
            {showDetailAction ? (
              <span className="relative inline-flex shrink-0">
                {detailOpenTooltipVisible ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-[5px] -translate-x-1/2"
                  >
                    <span
                      className="inline-flex h-[26px] w-max max-w-[min(280px,calc(100vw-32px))] shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#424449] px-2 font-title text-[13px] font-medium leading-none tracking-[0.13px] text-white"
                    >
                      Open details
                    </span>
                  </span>
                ) : null}
                <Link
                  href={detailHref}
                  className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-xl p-0 text-muted transition-colors hover:bg-[#eee] hover:text-foreground"
                  aria-label={`Open details for ${todo.title}`}
                  data-todo-open-detail=""
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={() => {
                    clearDetailOpenTooltipTimer();
                    detailOpenTooltipTimerRef.current = setTimeout(() => {
                      setDetailOpenTooltipVisible(true);
                      detailOpenTooltipTimerRef.current = null;
                    }, 1500);
                  }}
                  onMouseLeave={() => {
                    clearDetailOpenTooltipTimer();
                    setDetailOpenTooltipVisible(false);
                  }}
                >
                  <HugeiconsIcon icon={ArrowRightBigIcon} size={16} strokeWidth={1.75} />
                </Link>
              </span>
            ) : null}
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

                  {!todo.parent_id ? (
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
                  ) : null}

                  <Dropdown.Item
                    textValue="Delete"
                    className="text-[color:var(--color-danger)]"
                    onAction={() => {
                      setIsMoveSubmenuOpen(false);
                      startTodoTransition(async () => {
                        const snapshotTodo = todo;
                        addOptimistic({ type: "delete", id: todo.id });
                        const res = await deleteTodoAction(todo.id);
                        if ("error" in res) {
                          addOptimistic({ type: "add", todo: snapshotTodo });
                          toast.danger("Could not delete todo.", { timeout: 4500 });
                          scheduleRefresh();
                          return;
                        }
                        toast.success("Todo deleted.", { timeout: 2500 });
                        onTodoDeleted?.(todo.id);
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
          </span>
        </div>
      </div>
    </motion.li>
  );
}

export const PresenceTodoRow = forwardRef<
  HTMLLIElement,
  {
    todo: TodoRow;
    entranceDelay: number;
    skipEntranceAnimation?: boolean;
    showDetailAction?: boolean;
  } & TodoRowHandlers
>(function PresenceTodoRow(
  { todo, entranceDelay, skipEntranceAnimation, showDetailAction, ...handlers },
  ref,
) {
  return (
    <TodoRowMeasured
      todo={todo}
      rootRef={ref}
      entranceDelay={entranceDelay}
      skipEntranceAnimation={skipEntranceAnimation}
      showDetailAction={showDetailAction}
      {...handlers}
    />
  );
});

export const SortableTodoItem = forwardRef<
  HTMLLIElement,
  {
    todo: TodoRow;
    entranceDelay: number;
    skipEntranceAnimation?: boolean;
    showDetailAction?: boolean;
  } & TodoRowHandlers
>(function SortableTodoItem(
  { todo, entranceDelay, skipEntranceAnimation, showDetailAction, ...handlers },
  ref,
) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });

  return (
    <TodoRowMeasured
      todo={todo}
      rootRef={ref}
      entranceDelay={entranceDelay}
      skipEntranceAnimation={skipEntranceAnimation}
      showDetailAction={showDetailAction}
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
