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
  File01Icon,
  PlusSignIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import {
  Button,
  Dropdown,
  Input,
  Label,
  Modal,
  TextField,
  useOverlayState,
} from "@heroui/react";
import {
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  startTransition,
  useMemo,
  useTransition,
} from "react";
import { Reorder } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const hoveredTodoIdRef = useRef<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [uiOrderIds, setUiOrderIds] = useState<string[] | null>(null);
  const [isDraggingTodo, setIsDraggingTodo] = useState(false);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const reorderListRef = useRef<HTMLUListElement | null>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
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

  function scheduleRefresh() {
    queueMicrotask(() => router.refresh());
  }

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
    wrapper,
    wrapperProps,
  }: {
    todo: TodoRow;
    wrapper: React.ElementType;
    wrapperProps?: Record<string, unknown>;
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

    const rowClass = [
      "group flex items-center gap-3 rounded-[16px] px-3 transition-colors duration-150 ease-out hover:bg-[#f4f4f4]",
      isMultiline ? "py-2.5" : "py-1.5",
    ].join(" ");

    const Wrapper = wrapper as React.ElementType;
    const providedOnMouseEnter = (wrapperProps as
      | { onMouseEnter?: (e: React.MouseEvent) => void }
      | undefined)?.onMouseEnter;
    const providedOnMouseLeave = (wrapperProps as
      | { onMouseLeave?: (e: React.MouseEvent) => void }
      | undefined)?.onMouseLeave;

    const handleMouseEnter = (e: React.MouseEvent) => {
      providedOnMouseEnter?.(e);

      const rowEl = e.currentTarget as HTMLElement;
      const rowRect = rowEl.getBoundingClientRect();
      const checkboxEl = checkboxRef.current;
      const titleEl = titleRef.current;
      const actionsEl = actionsRef.current;

      if (!checkboxEl || !titleEl || !actionsEl) return;

      const checkboxRect = checkboxEl.getBoundingClientRect();
      const titleRect = titleEl.getBoundingClientRect();
      const actionsRect = actionsEl.getBoundingClientRect();

      const style = window.getComputedStyle(titleEl);
      const lineHeight = Number.parseFloat(style.lineHeight);
      const titleHeight = titleRect.height;

      // #region debug-log:hover-rects
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "e410d4",
        },
        body: JSON.stringify({
          sessionId: "e410d4",
          runId: "pre-fix-hover-1",
          hypothesisId: "H3-hover-alignment",
          location: "today-client.tsx:TodoRowMeasured:handleMouseEnter",
          message: "Hover measurement rects + multiline state",
          data: {
            showCompleted,
            composerListIdPresent: Boolean(composerListId),
            todoId: todo.id,
            rowTop: rowRect.top,
            checkboxTop: checkboxRect.top,
            titleTop: titleRect.top,
            actionsTop: actionsRect.top,
            deltaCheckboxTop: checkboxRect.top - rowRect.top,
            deltaActionsTop: actionsRect.top - rowRect.top,
            lineHeight,
            titleHeight,
            isMultiline,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
      providedOnMouseLeave?.(e);
    };
    return (
      <Wrapper
        {...wrapperProps}
        className={[
          rowClass,
          (wrapperProps?.["className"] as string | undefined) ?? "",
        ].join(" ").trim()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <input
          type="checkbox"
          className={[
            "todo-checkbox-squircle",
            // Multiline ise checkbox'u ilk satır hizasına yaklaştırmak için container'ın üstüne al.
            isMultiline ? "self-start" : "self-center",
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
            // Multiline satırda checkbox ilk satıra hizalanınca aksiyonları da aynı hatta çek.
            isMultiline ? "self-start -mt-1" : "",
          ].join(" ").trim()}
        >
          <span className="p-0.5 text-muted" aria-hidden="true">
            <HugeiconsIcon icon={File01Icon} size={15} strokeWidth={1.75} />
          </span>
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
      </Wrapper>
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
    if (!isDraggingTodo) return;

    const computeIndicator = (clientY: number) => {
      const listEl = reorderListRef.current;
      if (!listEl) return;

      // Only consider non-dragged rows when computing insertion position.
      const rowEls = Array.from(
        listEl.querySelectorAll<HTMLElement>("[data-todo-row='1']"),
      ).filter((el) => el.dataset.todoId !== draggingTodoId);

      if (rowEls.length === 0) {
        setDropIndicatorTop(null);
        return;
      }

      const listRect = listEl.getBoundingClientRect();
      const mids = rowEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { el, top: r.top, bottom: r.bottom, mid: r.top + r.height / 2 };
      });

      let insertIndex = mids.findIndex((m) => clientY < m.mid);
      if (insertIndex === -1) insertIndex = mids.length;

      const topPx =
        insertIndex === 0
          ? mids[0]!.top - listRect.top
          : mids[insertIndex - 1]!.bottom - listRect.top;

      // Clamp to list bounds to avoid jitter on overscroll.
      const clamped = Math.max(0, Math.min(topPx, listRect.height));
      setDropIndicatorTop(clamped);
    };

    const onPointerMove = (e: PointerEvent) => {
      computeIndicator(e.clientY);
    };

    const onScroll = () => {
      // Recompute from last known pointer position if possible.
      // If we can't, we keep the current line until next move.
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isDraggingTodo, draggingTodoId]);

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

  function persistReorderIfPossible() {
    const orderedIds = latestOrderRef.current;
    if (!orderedIds || orderedIds.length === 0) return;
    // #region debug-log:persistReorderIfPossible
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

    startTodoTransition(async () => {
      if (composerListId) {
        await reorderTodosAction(composerListId, mergedIds);
      } else if (pathname === "/all") {
        await reorderAllTodosAction(mergedIds);
      }
      scheduleRefresh();
    });
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

  return (
    <div className="today-shell flex w-full flex-col text-foreground">
      {listDeleteInlineError ? (
        <p className="mb-2 text-sm text-[color:var(--color-danger)]" role="alert">
          {listDeleteInlineError}
        </p>
      ) : null}
      <div className="mb-5 flex w-full items-start justify-between gap-3">
        <nav
          className="flex w-full flex-wrap items-center gap-[2px]"
          aria-label="List filters"
        >
          <Link
            href="/all"
            className={filterChipClass("/all")}
            aria-current={pathname === "/all" ? "page" : undefined}
          >
            All <span className="text-muted/70">•</span> {counts.all}
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
                {list.title} <span className="text-muted/70">•</span> {counts.byListId[list.id] ?? 0}
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

        <Dropdown.Root>
          <Dropdown.Trigger>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[13px] font-medium text-muted hover:text-foreground">
              <HugeiconsIcon icon={SlidersHorizontalIcon} size={16} strokeWidth={1.75} className="text-current" />
              Display
            </span>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label="Display options">
              <Dropdown.Item
                onAction={() => setShowCompleted((v) => !v)}
                textValue={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{showCompleted ? "Hide completed tasks" : "Show completed tasks"}</span>
                  <span className="text-xs text-muted">
                    {showCompleted ? "Shown" : "Hidden"}
                  </span>
                </div>
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
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu>
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
          <Reorder.Group
            as="ul"
            axis="y"
            ref={reorderListRef}
            className="relative flex flex-col"
            values={uiOrderIds ?? visibleIds}
            onReorder={(orderedIds) => {
              latestOrderRef.current = orderedIds;
              // #region debug-log:reorder-onReorder
              fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Session-Id": "e410d4",
                },
                body: JSON.stringify({
                  sessionId: "e410d4",
                  runId: "pre-fix-reorder-1",
                  hypothesisId: "H1-optimistic-outside-transition",
                  location: "today-client.tsx:Reorder.Group:onReorder",
                  message: "Reorder onReorder fired (before optimistic update)",
                  data: {
                    orderedIdsLength: orderedIds.length,
                    showCompleted,
                    composerListIdPresent: Boolean(composerListId),
                    composerListId: composerListId ?? null,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
              // #endregion
              startTransition(() => {
                setUiOrderIds(orderedIds);
              });
            }}
          >
            <div
              aria-hidden
              className={[
                "pointer-events-none absolute left-2 right-2 z-10",
                "transition-all duration-150 ease-in-out",
                dropIndicatorTop === null ? "opacity-0" : "opacity-100",
              ].join(" ")}
              style={dropIndicatorTop === null ? undefined : { top: dropIndicatorTop }}
            >
              <div className="border-t-2 border-dashed border-primary/40" />
              <div className="mt-1 h-3 rounded-md bg-primary/10 opacity-70" />
            </div>
            {orderedVisibleTodos.map((todo) => (
              <TodoRowMeasured
                key={todo.id}
                todo={todo}
                wrapper={Reorder.Item}
                wrapperProps={{
                  as: "li",
                  value: todo.id,
                  "data-todo-row": "1",
                  "data-todo-id": todo.id,
                  layout: true,
                  whileDrag: {
                    scale: 1.02,
                    opacity: 0.85,
                    boxShadow: "0 18px 40px rgba(0,0,0,0.14)",
                  },
                  transition: { type: "spring", stiffness: 700, damping: 55 },
                  dragTransition: { bounceStiffness: 700, bounceDamping: 60 },
                  onDragStart: () => {
                    setIsDraggingTodo(true);
                    setDraggingTodoId(todo.id);
                  },
                  onMouseEnter: () => {
                    hoveredTodoIdRef.current = todo.id;
                  },
                  onMouseLeave: () => {
                    hoveredTodoIdRef.current = null;
                  },
                  onClick: (e: React.MouseEvent) => {
                    const el = e.target as HTMLElement;
                    if (el.closest('input[type="checkbox"]')) return;
                    if (el.closest("button")) return;
                    setSelectedTodoId(todo.id);
                  },
                  onDragEnd: () => {
                    setIsDraggingTodo(false);
                    setDraggingTodoId(null);
                    setDropIndicatorTop(null);
                    persistReorderIfPossible();
                  },
                }}
              />
            ))}
          </Reorder.Group>
        ) : (
          <ul className="flex flex-col">
            {visibleTodos.map((todo) => (
              <TodoRowMeasured
                key={todo.id}
                todo={todo}
                wrapper="li"
                wrapperProps={{
                  onMouseEnter: () => {
                    hoveredTodoIdRef.current = todo.id;
                  },
                  onMouseLeave: () => {
                    hoveredTodoIdRef.current = null;
                  },
                  onClick: (e: React.MouseEvent) => {
                    const el = e.target as HTMLElement;
                    if (el.closest('input[type="checkbox"]')) return;
                    if (el.closest("button")) return;
                    setSelectedTodoId(todo.id);
                  },
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
