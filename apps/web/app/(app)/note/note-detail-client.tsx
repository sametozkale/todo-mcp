"use client";

import {
  deleteNoteAction,
  duplicateNoteAction,
  moveNoteToNoteListAction,
  updateNoteDescriptionAction,
  updateNoteTitleAction,
} from "@/app/(app)/notes/actions";
import { useNoteListsShell } from "@/app/(app)/note-lists-shell";
import { insertPlainTextIntoContentEditable } from "@/app/(app)/notes/note-row";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { ChevronRight, Copy, Ellipsis, Folder, ArrowLeft } from "lucide-react";
import { Dropdown } from "@heroui/react";
import { toast } from "@/lib/app-toast";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type NoteDetailParent = {
  id: string;
  title: string;
  note_list_id: string | null;
  description: string | null;
};

export function NoteDetailClient({
  backHref,
  initialParent,
}: {
  backHref: string;
  initialParent: NoteDetailParent;
}) {
  const router = useRouter();
  const { lists } = useNoteListsShell();
  const [parent, setParent] = useState(initialParent);
  const [isNotePending, startNoteTransition] = useTransition();

  const titleRef = useRef<HTMLSpanElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const isTitleFocusedRef = useRef(false);
  const isDescriptionFocusedRef = useRef(false);
  const discardTitleRef = useRef(false);
  const discardDescriptionRef = useRef(false);

  useEffect(() => {
    setParent(initialParent);
  }, [initialParent]);

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

  useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (!el || isDescriptionFocusedRef.current) return;
    const next = parent.description ?? "";
    if (el.innerText !== next) {
      el.textContent = next;
    }
  }, [parent.description]);

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
    startNoteTransition(async () => {
      setParent((p) => ({ ...p, title: next }));
      const res = await updateNoteTitleAction(parent.id, next);
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
  }, [parent.id, parent.title, scheduleRefresh, startNoteTransition]);

  const commitDescription = useCallback(() => {
    const el = descriptionRef.current;
    if (!el) return;
    const next = (el.innerText ?? "").replace(/\r\n/g, "\n");
    const normalized = next.trim() ? next.trimEnd() : "";
    const prev = parent.description ?? "";
    if (normalized === prev) return;
    startNoteTransition(async () => {
      setParent((p) => ({ ...p, description: normalized || null }));
      const res = await updateNoteDescriptionAction(parent.id, normalized);
      if ("error" in res) {
        setParent((p) => ({ ...p, description: prev || null }));
        el.textContent = prev;
        toast.danger(res.error ?? "Could not update description.", { timeout: 4500 });
        scheduleRefresh();
        return;
      }
      if (!normalized) el.textContent = "";
      scheduleRefresh();
    });
  }, [parent.description, parent.id, scheduleRefresh, startNoteTransition]);

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const moveTargets = lists.filter((l) => l.id !== parent.note_list_id);

  function slugForNoteListId(noteListId: string | null): string | null {
    if (!noteListId) return null;
    return lists.find((l) => l.id === noteListId)?.slug ?? null;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 text-foreground">
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <Link
          href={backHref}
          style={{ borderRadius: 10 }}
          className="group inline-flex h-7 max-h-7 shrink-0 items-center gap-0 overflow-hidden py-0 pl-1.5 pr-2 text-muted transition-[gap,colors] duration-200 hover:bg-[#eee] hover:text-foreground group-hover:gap-2.5"
          aria-label="Back to folder"
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
            isDisabled={isNotePending}
          >
            <Ellipsis size={16} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" style={{ width: "max-content", minWidth: "0px", overflow: "visible" }}>
            <Dropdown.Menu
              className="w-fit max-w-max min-w-0 overflow-visible"
              aria-label={`Note actions for ${parent.title}`}
            >
              <Dropdown.Item
                textValue="Duplicate"
                onAction={() => {
                  setIsMoveOpen(false);
                  startNoteTransition(async () => {
                    const res = await duplicateNoteAction(parent.id);
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
              <Dropdown.Item textValue="Move to folder">
                <div
                  className="relative -mx-1 overflow-visible"
                  onMouseEnter={() => setIsMoveOpen(true)}
                  onMouseLeave={() => setIsMoveOpen(false)}
                >
                  <div className="flex w-full items-center justify-between gap-3 px-1 py-0.5">
                    <span className="inline-flex items-center gap-2">
                      <Folder size={14} />
                      <span>Move to folder</span>
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
                              startNoteTransition(async () => {
                                const res = await moveNoteToNoteListAction(parent.id, list.id);
                                if ("error" in res) {
                                  toast.danger("Could not move note.", { timeout: 4500 });
                                  scheduleRefresh();
                                  return;
                                }
                                toast.success(`Moved to ${list.title}.`, { timeout: 2200 });
                                const slug = slugForNoteListId(list.id);
                                if (slug) router.push(`/notes/${slug}`);
                                else router.push("/notes/all");
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
              <Dropdown.Item
                textValue="Delete"
                className="text-[color:var(--color-danger)]"
                onAction={() => {
                  setIsMoveOpen(false);
                  startNoteTransition(async () => {
                    const res = await deleteNoteAction(parent.id);
                    if ("error" in res) {
                      toast.danger("Could not delete note.", { timeout: 4500 });
                      scheduleRefresh();
                      return;
                    }
                    toast.success("Note deleted.", { timeout: 2500 });
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
          data-note-title=""
          role="textbox"
          tabIndex={isNotePending ? -1 : 0}
          contentEditable={!isNotePending}
          suppressContentEditableWarning
          spellCheck={false}
          suppressHydrationWarning
          className="block w-full min-w-0 max-w-full cursor-text border-0 text-[22px] font-semibold leading-7 text-foreground shadow-none outline-none ring-0 focus:outline-none focus:ring-0"
          aria-label={`Edit note title: ${parent.title}`}
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

      <div
        ref={descriptionRef}
        data-note-description=""
        data-placeholder="Write your note…"
        role="textbox"
        tabIndex={isNotePending ? -1 : 0}
        contentEditable={!isNotePending}
        suppressContentEditableWarning
        spellCheck
        suppressHydrationWarning
        aria-label="Note description"
        aria-multiline="true"
        className="block min-h-[1.5rem] w-full min-w-0 max-w-full cursor-text whitespace-pre-wrap break-words border-0 text-[14px] leading-6 text-foreground shadow-none outline-none ring-0 empty:before:pointer-events-none empty:before:text-muted empty:before:content-[attr(data-placeholder)] focus:outline-none focus:ring-0"
        onFocus={() => {
          isDescriptionFocusedRef.current = true;
        }}
        onBlur={() => {
          isDescriptionFocusedRef.current = false;
          if (discardDescriptionRef.current) {
            discardDescriptionRef.current = false;
            return;
          }
          commitDescription();
        }}
        onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Escape") {
            e.preventDefault();
            discardDescriptionRef.current = true;
            e.currentTarget.textContent = parent.description ?? "";
            e.currentTarget.blur();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
          insertPlainTextIntoContentEditable(e.currentTarget, text);
        }}
      />
    </div>
  );
}
