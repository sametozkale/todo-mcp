"use client";

import {
  deleteNoteAction,
  duplicateNoteAction,
  moveNoteToNoteListAction,
  updateNoteTitleAction,
} from "@/app/(app)/notes/actions";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRightBigIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { ChevronRight, Copy, Ellipsis, Folder } from "lucide-react";
import { Dropdown } from "@heroui/react";
import { toast } from "@/lib/app-toast";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type Ref,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

export type NoteRow = {
  id: string;
  title: string;
  is_completed: boolean | null;
  note_list_id: string | null;
  parent_id?: string | null;
  sub_note_completed_count?: number;
  sub_note_total_count?: number;
};

export type NoteOptimisticAction =
  | { type: "delete"; id: string }
  | { type: "add"; note: NoteRow }
  | { type: "duplicateAfter"; afterId: string; note: NoteRow }
  | { type: "moveList"; id: string; note_list_id: string | null }
  | { type: "updateTitle"; id: string; title: string };

/** Listeden çıkış: hafif sola kayma + küçülme + soldurma (FM’de silme için yaygın pattern). */
export const NOTE_ROW_EXIT = {
  opacity: 0,
  x: -14,
  scale: 0.975,
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const },
};

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

export type NoteRowHandlers = {
  lists: { id: string; title: string }[];
  view?: "all" | "list";
  composerNoteListId: string | null;
  setSelectedNoteId: (id: string) => void;
  isNotePending: boolean;
  startNoteTransition: (cb: () => void | Promise<void>) => void;
  addOptimistic: (action: NoteOptimisticAction) => void;
  scheduleRefresh: () => void;
  onNoteDeleted?: (deletedId: string) => void;
};

export function NoteRowMeasured({
  todo,
  rootRef,
  entranceDelay,
  lists,
  view,
  composerNoteListId,
  setSelectedNoteId,
  isNotePending,
  startNoteTransition,
  addOptimistic,
  scheduleRefresh,
  onNoteDeleted,
  skipEntranceAnimation,
  showDetailAction = true,
}: {
  todo: NoteRow;
  rootRef?: Ref<HTMLLIElement | null>;
  entranceDelay: number;
  skipEntranceAnimation?: boolean;
  /** Ana todo satırında `/note/:id` kısayolu; sub-note’larda kapalı. */
  showDetailAction?: boolean;
} & NoteRowHandlers) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const titleRef = useRef<HTMLSpanElement>(null);
  const isTitleFocusedRef = useRef(false);
  const discardTitleEditRef = useRef(false);
  const [isMultiline, setIsMultiline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
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
  }, [todo.title]);

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
    startNoteTransition(async () => {
      addOptimistic({ type: "updateTitle", id: todo.id, title: next });
      const res = await updateNoteTitleAction(todo.id, next);
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
  }, [addOptimistic, scheduleRefresh, startNoteTransition, todo.id, todo.title]);

  const mergedLiRef = useCallback(
    (node: HTMLLIElement | null) => {
      const r = rootRef;
      if (!r) return;
      if (typeof r === "function") r(node);
      else (r as MutableRefObject<HTMLLIElement | null>).current = node;
    },
    [rootRef],
  );

  const rowInnerClass = [
    "relative min-w-0 flex-1 rounded-[16px] px-3 transition-colors duration-150 ease-out",
    isMenuOpen ? "bg-[#f4f4f4]" : "group-hover:bg-[#f4f4f4]",
    isMultiline ? "py-2.5" : "py-1.5",
  ].join(" ");

  const actionsRevealed = isMenuOpen || isRowHovered;
  // Two icon slots (28px) + gap ≈ 52px; single menu icon ≈ 28px. Height = 2 × leading-5.
  const iconSlotWidth = showDetailAction ? 52 : 28;
  const revealTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  const moveTargets = lists.filter((list) => list.id !== todo.note_list_id);
  const detailHref = pathname ? `/note/${todo.id}?from=${encodeURIComponent(pathname)}` : `/note/${todo.id}`;

  return (
    <motion.li
      ref={mergedLiRef}
      layout
      initial={skipEntranceAnimation ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        opacity: { duration: 0.2, delay: skipEntranceAnimation ? 0 : entranceDelay },
        y: {
          duration: 0.22,
          ease: [0.32, 0.72, 0, 1],
          delay: skipEntranceAnimation ? 0 : entranceDelay,
        },
        layout: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
      }}
      exit={NOTE_ROW_EXIT}
      className="group relative mb-[2px] w-full list-none last:mb-0"
      data-todo-row="1"
      data-note-id={todo.id}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("button")) return;
        if (el.closest("a")) return;
        if (el.closest("[data-note-title]")) return;
        setSelectedNoteId(todo.id);
      }}
    >
      <div className="relative flex min-w-0 flex-1">
        <div className={rowInnerClass}>
          {/* Float reserves space for only the first two lines; lines below stay full width. */}
          <motion.span
            aria-hidden
            className="float-right h-10"
            initial={false}
            animate={{ width: actionsRevealed ? iconSlotWidth : 0 }}
            transition={revealTransition}
          />

          <span
            ref={titleRef}
            data-note-title=""
            role="textbox"
            tabIndex={isNotePending ? -1 : 0}
            contentEditable={!isNotePending}
            suppressContentEditableWarning
            spellCheck={false}
            className="block w-full min-w-0 cursor-text border-0 text-[14px] leading-5 text-foreground shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none"
            aria-label={`Edit note title: ${todo.title}`}
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

          <motion.span
            className={[
              // Todos: px-3 + -mr-[6px] → 6px from the row edge. Absolute uses right-1.5.
              "absolute right-1.5 z-[2] flex shrink-0 items-center gap-0.5",
              isMultiline ? "top-2.5 -mt-1" : "top-1/2 -translate-y-1/2",
            ].join(" ")}
            initial={false}
            animate={{ opacity: actionsRevealed ? 1 : 0 }}
            transition={revealTransition}
            style={{ pointerEvents: actionsRevealed ? "auto" : "none" }}
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
                isDisabled={isNotePending}
              >
                <Ellipsis size={16} />
              </Dropdown.Trigger>

              <Dropdown.Popover
                placement="bottom end"
                style={{ width: "max-content", minWidth: "0px", overflow: "visible" }}
              >
                <Dropdown.Menu
                  className="w-fit max-w-max min-w-0 overflow-visible"
                  aria-label={`Note actions for ${todo.title}`}
                >
                  <Dropdown.Item
                    textValue="Duplicate"
                    onAction={() => {
                      setIsMoveSubmenuOpen(false);
                      startNoteTransition(async () => {
                        const duplicated: NoteRow = {
                          ...todo,
                          id: `optimistic-dup-${crypto.randomUUID()}`,
                        };
                        addOptimistic({ type: "duplicateAfter", afterId: todo.id, note: duplicated });
                        const res = await duplicateNoteAction(todo.id);
                        if ("error" in res) {
                          toast.danger("Could not duplicate note.", { timeout: 4500 });
                          scheduleRefresh();
                          return;
                        }
                        toast.success("Note duplicated.", { timeout: 2200 });
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
                    <Dropdown.Item textValue="Move to folder">
                      <div
                        className="relative -mx-1 overflow-visible"
                        onMouseEnter={() => setIsMoveSubmenuOpen(true)}
                        onMouseLeave={() => setIsMoveSubmenuOpen(false)}
                      >
                        <div className="flex w-full items-center justify-between gap-3 px-1 py-0.5">
                          <span className="inline-flex items-center gap-2">
                            <Folder size={14} />
                            <span>Move to folder</span>
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
                                    startNoteTransition(async () => {
                                      const prevNoteListId = todo.note_list_id;
                                      addOptimistic({ type: "moveList", id: todo.id, note_list_id: list.id });
                                      if (view !== "all" && composerNoteListId) {
                                        addOptimistic({ type: "delete", id: todo.id });
                                      }
                                      const res = await moveNoteToNoteListAction(todo.id, list.id);
                                      if ("error" in res) {
                                        addOptimistic({ type: "moveList", id: todo.id, note_list_id: prevNoteListId });
                                        toast.danger("Could not move note.", { timeout: 4500 });
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
                              <p className="px-2.5 py-2 text-[12px] text-muted">No other folders</p>
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
                      startNoteTransition(async () => {
                        const snapshotTodo = todo;
                        addOptimistic({ type: "delete", id: todo.id });
                        const res = await deleteNoteAction(todo.id);
                        if ("error" in res) {
                          addOptimistic({ type: "add", note: snapshotTodo });
                          toast.danger("Could not delete note.", { timeout: 4500 });
                          scheduleRefresh();
                          return;
                        }
                        toast.success("Note deleted.", { timeout: 2500 });
                        onNoteDeleted?.(todo.id);
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
          </motion.span>
        </div>
      </div>
    </motion.li>
  );
}

export const PresenceNoteRow = forwardRef<
  HTMLLIElement,
  {
    todo: NoteRow;
    entranceDelay: number;
    skipEntranceAnimation?: boolean;
    showDetailAction?: boolean;
  } & NoteRowHandlers
>(function PresenceNoteRow(
  { todo, entranceDelay, skipEntranceAnimation, showDetailAction, ...handlers },
  ref,
) {
  return (
    <NoteRowMeasured
      todo={todo}
      rootRef={ref}
      entranceDelay={entranceDelay}
      skipEntranceAnimation={skipEntranceAnimation}
      showDetailAction={showDetailAction}
      {...handlers}
    />
  );
});
