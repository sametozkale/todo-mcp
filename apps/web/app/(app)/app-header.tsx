"use client";

import { updateProfileAction } from "@/app/(app)/profile/actions";
import { ToDoMcpLogo } from "@/components/brand/to-do-mcp-logo";
import { PaymentModal } from "@/components/PaymentModal";
import { useSubscription } from "@/hooks/useSubscription";
import { createClient } from "@/lib/supabase/client";
import {
  Logout02Icon,
  McpServerIcon,
  PuzzleIcon,
  SentIcon,
  UserCircleIcon,
  KeyboardIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Avatar,
  Button,
  Description,
  Dropdown,
  Input,
  Label,
  Modal,
  TextField,
  useOverlayState,
} from "@heroui/react";
import { Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  YALP_OPEN_KEYBOARD_SHORTCUTS,
  YALP_OPEN_PROFILE,
  YALP_OPEN_PLANS,
} from "@/lib/yalp-shortcut-events";

const DEFAULT_AVATAR_SRC =
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg";

const ACCOUNT_TRIGGER_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#00b5e9]";

const KBD_BASE =
  "inline-flex h-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-[10px] border border-[#e6e6e6] bg-white px-2 font-sans text-[12px] font-semibold text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)]";

function ShortcutRow({ keys, label }: { keys: ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#efefef] bg-[#fafafa] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">{keys}</div>
      <span className="min-w-0 flex-1 text-muted">{label}</span>
    </div>
  );
}

function getInitials(fullName: string, email: string | null) {
  const n = fullName.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "?";
}

export type AppHeaderProps = {
  initialProfile: {
    fullName: string;
    avatarUrl: string | null;
  };
  userEmail: string | null;
};

export function AppHeader({ initialProfile, userEmail }: AppHeaderProps) {
  const router = useRouter();
  const subscription = useSubscription();
  const profileModal = useOverlayState();
  const shortcutsModal = useOverlayState();
  const [modSymbol, setModSymbol] = useState("Ctrl");
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  /** HeroUI / React Aria ids must not run until after hydration (avoids Next RSC + useId drift). */
  const [overlaysReady, setOverlaysReady] = useState(false);

  useEffect(() => {
    setOverlaysReady(true);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setModSymbol(/Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);

  const openShortcutsRef = useRef(() => {});
  const openProfileRef = useRef(() => {});
  const openPlansRef = useRef(() => {});
  openShortcutsRef.current = () => {
    shortcutsModal.open();
  };
  openProfileRef.current = () => {
    profileModal.open();
  };
  openPlansRef.current = () => {
    subscription.openPaymentModal({ dismissible: true });
  };

  useEffect(() => {
    const onShortcuts = () => openShortcutsRef.current();
    const onProfile = () => openProfileRef.current();
    const onPlans = () => openPlansRef.current();
    window.addEventListener(YALP_OPEN_KEYBOARD_SHORTCUTS, onShortcuts);
    window.addEventListener(YALP_OPEN_PROFILE, onProfile);
    window.addEventListener(YALP_OPEN_PLANS, onPlans);
    return () => {
      window.removeEventListener(YALP_OPEN_KEYBOARD_SHORTCUTS, onShortcuts);
      window.removeEventListener(YALP_OPEN_PROFILE, onProfile);
      window.removeEventListener(YALP_OPEN_PLANS, onPlans);
    };
  }, []);

  useEffect(() => {
    const onShortcutsObserved = () => {
      // #region agent log
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
        body: JSON.stringify({
          sessionId: "fd174b",
          runId: "shortcuts-audit-1",
          hypothesisId: "H5-header-not-receiving-custom-events",
          location: "app-header.tsx:useEffect",
          message: "Header observed shortcuts event",
          data: { eventName: YALP_OPEN_KEYBOARD_SHORTCUTS, overlaysReady, isOpen: shortcutsModal.isOpen },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };
    const onProfileObserved = () => {
      // #region agent log
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
        body: JSON.stringify({
          sessionId: "fd174b",
          runId: "shortcuts-audit-1",
          hypothesisId: "H5-header-not-receiving-custom-events",
          location: "app-header.tsx:useEffect",
          message: "Header observed profile event",
          data: { eventName: YALP_OPEN_PROFILE, overlaysReady, isOpen: profileModal.isOpen },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };
    const onPlansObserved = () => {
      // #region agent log
      fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fd174b" },
        body: JSON.stringify({
          sessionId: "fd174b",
          runId: "shortcuts-audit-1",
          hypothesisId: "H5-header-not-receiving-custom-events",
          location: "app-header.tsx:useEffect",
          message: "Header observed plans event",
          data: { eventName: YALP_OPEN_PLANS, overlaysReady },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };
    window.addEventListener(YALP_OPEN_KEYBOARD_SHORTCUTS, onShortcutsObserved);
    window.addEventListener(YALP_OPEN_PROFILE, onProfileObserved);
    window.addEventListener(YALP_OPEN_PLANS, onPlansObserved);
    return () => {
      window.removeEventListener(YALP_OPEN_KEYBOARD_SHORTCUTS, onShortcutsObserved);
      window.removeEventListener(YALP_OPEN_PROFILE, onProfileObserved);
      window.removeEventListener(YALP_OPEN_PLANS, onPlansObserved);
    };
  }, [overlaysReady, profileModal.isOpen, shortcutsModal.isOpen]);

  useEffect(() => {
    if (!profileModal.isOpen) return;
    setFullName(initialProfile.fullName);
    setAvatarUrl(initialProfile.avatarUrl ?? "");
    setFormError(null);
  }, [profileModal.isOpen, initialProfile]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    profileModal.close();
    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (result.ok) {
        queueMicrotask(() => router.refresh());
      } else {
        profileModal.open();
        setFormError(result.error);
      }
    });
  }

  const displayName = initialProfile.fullName.trim() || userEmail || "Account";
  const avatarSrc =
    initialProfile.avatarUrl?.trim() || DEFAULT_AVATAR_SRC;
  const initials = getInitials(initialProfile.fullName, userEmail);
  const profileModalPreviewSrc = avatarUrl.trim() || DEFAULT_AVATAR_SRC;
  const profileModalInitials = getInitials(fullName, userEmail);
  const profileEmail = userEmail ?? "No email available";

  return (
    <>
      <header className="sticky top-0 z-10">
        <div className="flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
          <Link href="/all" className="inline-flex shrink-0 items-center no-underline">
            <ToDoMcpLogo className="block h-6 w-6 max-w-none" />
          </Link>

          {overlaysReady ? (
            <Dropdown.Root>
              <Dropdown.Trigger
                className={ACCOUNT_TRIGGER_CLASS}
                aria-label="Account menu"
              >
                <Avatar className="size-6 ring-0">
                  <Avatar.Image alt={displayName} src={avatarSrc} />
                  <Avatar.Fallback>{initials}</Avatar.Fallback>
                </Avatar>
              </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom end"
              style={{ width: "max-content", minWidth: "0px" }}
            >
                <Dropdown.Menu className="w-fit max-w-max min-w-0">
                  <Dropdown.Item
                    onAction={() => profileModal.open()}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={UserCircleIcon} size={16} strokeWidth={1.75} />
                      <span>Profile</span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item onAction={() => shortcutsModal.open()}>
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={KeyboardIcon} size={16} strokeWidth={1.75} />
                      <span>Shortcuts</span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    onAction={() => {
                      window.location.href = "mailto:ozkalesamet@gmail.com";
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.75} />
                      <span>Support</span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    onAction={() => subscription.openPaymentModal({ dismissible: true })}
                    textValue="Plans"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Zap size={16} className="text-muted" />
                      <span className="inline-flex items-center gap-2">
                        <span>Plans</span>
                        {subscription.plan === "free" ? (
                          <span className="rounded-full bg-[#f4f4f4] px-2 py-0.5 text-[11px] font-medium text-muted">
                            Free
                          </span>
                        ) : subscription.plan === "lifetime" ? (
                          <span className="rounded-full bg-[#e8f7fc] px-2 py-0.5 text-[11px] font-semibold text-[#0078a8]">
                            Lifetime
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#e8f7fc] px-2 py-0.5 text-[11px] font-semibold text-[#0078a8]">
                            Pro
                          </span>
                        )}
                      </span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    isDisabled
                    textValue="separator"
                    className="pointer-events-none mx-auto my-[2px] h-px min-h-px w-[calc(100%-24px)] max-w-full cursor-default bg-[#f4f4f4] px-0 py-0 opacity-100"
                  >
                    <span aria-hidden="true" />
                  </Dropdown.Item>
                  <Dropdown.Item
                    onAction={() => {
                      router.push("/integrations");
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={PuzzleIcon} size={16} strokeWidth={1.75} />
                      <span>Integrations</span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    onAction={() => {
                      router.push("/mcp");
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={McpServerIcon} size={16} strokeWidth={1.75} />
                      <span>MCP Connections</span>
                    </span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    isDisabled
                    textValue="separator"
                    className="pointer-events-none mx-auto my-[2px] h-px min-h-px w-[calc(100%-24px)] max-w-full cursor-default bg-[#f4f4f4] px-0 py-0 opacity-100"
                  >
                    <span aria-hidden="true" />
                  </Dropdown.Item>
                  <Dropdown.Item
                    onAction={handleLogout}
                    className="text-[#ccc] hover:text-foreground focus:text-foreground data-[hovered]:text-foreground data-[focused]:text-foreground"
                  >
                    <span className="inline-flex items-center gap-2 text-inherit">
                      <HugeiconsIcon
                        icon={Logout02Icon}
                        size={16}
                        strokeWidth={1.75}
                        className="text-current"
                      />
                      <span>Log out</span>
                    </span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          ) : (
            <button
              type="button"
              disabled
              className={`${ACCOUNT_TRIGGER_CLASS} cursor-default`}
              aria-label="Account menu"
              aria-busy="true"
            >
              <Avatar className="size-6 ring-0">
                <Avatar.Image alt={displayName} src={avatarSrc} />
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar>
            </button>
          )}
        </div>
      </header>

      {overlaysReady ? (
        <Modal.Root state={profileModal}>
          <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
            <span aria-hidden="true" />
          </Modal.Trigger>
          <Modal.Backdrop>
            <Modal.Container size="md" placement="center">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="mb-[24px]">
                  <Modal.Heading>Profile</Modal.Heading>
                </Modal.Header>
                <form onSubmit={handleProfileSubmit}>
                  <Modal.Body className="flex flex-col gap-4 pt-0">
                    <div className="flex justify-start">
                      <Avatar className="h-12 w-12 shrink-0 overflow-hidden ring-0 ring-offset-0">
                        <Avatar.Image
                          alt={fullName.trim() ? `${fullName.trim()} — profile photo` : "Profile photo preview"}
                          src={profileModalPreviewSrc}
                        />
                        <Avatar.Fallback className="text-sm font-semibold">
                          {profileModalInitials}
                        </Avatar.Fallback>
                      </Avatar>
                    </div>
                    {formError ? (
                      <p className="text-sm text-[color:var(--color-danger)]" role="alert">
                        {formError}
                      </p>
                    ) : null}
                    <TextField.Root
                      name="full_name"
                      value={fullName}
                      onChange={setFullName}
                      isRequired
                    >
                      <Label>Full name</Label>
                      <Input placeholder="Your name" />
                    </TextField.Root>
                    <TextField.Root value={profileEmail} isDisabled>
                      <Label>Email</Label>
                      <Input />
                    </TextField.Root>
                    <TextField.Root
                      name="avatar_url"
                      value={avatarUrl}
                      onChange={setAvatarUrl}
                    >
                      <Label>Avatar URL</Label>
                      <Input placeholder="https://…" type="text" autoComplete="photo" />
                      <Description>
                        Image URL for your profile photo. Leave empty to use the default
                        avatar.
                      </Description>
                    </TextField.Root>
                  </Modal.Body>
                  <Modal.Footer className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      slot="close"
                      isDisabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" isPending={isPending}>
                      Save
                    </Button>
                  </Modal.Footer>
                </form>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal.Root>
      ) : null}

      {overlaysReady ? (
        <Modal.Root state={shortcutsModal}>
          <Modal.Trigger className="sr-only absolute h-px w-px overflow-hidden border-0 p-0 opacity-0">
            <span aria-hidden="true" />
          </Modal.Trigger>
          <Modal.Backdrop>
            <Modal.Container size="md" placement="center">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="mb-[18px]">
                  <Modal.Heading>Keyboard shortcuts</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="max-h-[min(70vh,560px)] overflow-y-auto pt-0">
                  <div className="space-y-2 text-[13px] leading-snug text-foreground">
                    <ShortcutRow keys={<kbd className={KBD_BASE}>N</kbd>} label="Focus the new todo input" />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>H</kbd>} label="Hide / show completed tasks" />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>?</kbd>} label="Open this shortcuts panel" />

                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>G</kbd>
                          <span className="px-0.5 text-[11px] text-muted">then</span>
                          <kbd className={KBD_BASE}>A</kbd>
                        </>
                      }
                      label="Go to All"
                    />
                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>G</kbd>
                          <span className="px-0.5 text-[11px] text-muted">then</span>
                          <kbd className={KBD_BASE}>I</kbd>
                        </>
                      }
                      label="Open MCP Connections"
                    />
                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>G</kbd>
                          <span className="px-0.5 text-[11px] text-muted">then</span>
                          <kbd className={KBD_BASE}>U</kbd>
                        </>
                      }
                      label="Open Profile"
                    />
                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>G</kbd>
                          <span className="px-0.5 text-[11px] text-muted">then</span>
                          <kbd className={KBD_BASE}>P</kbd>
                        </>
                      }
                      label="Open Plans"
                    />
                    <p className="px-1 text-[11px] leading-snug text-muted">
                      Tip: After <kbd className={KBD_BASE}>G</kbd>, press <kbd className={KBD_BASE}>G</kbd> again to cancel
                      the sequence.
                    </p>

                    <ShortcutRow keys={<kbd className={KBD_BASE}>[</kbd>} label="Previous list (All, then your lists in tab order)" />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>]</kbd>} label="Next list (All, then your lists in tab order)" />

                    <ShortcutRow keys={<kbd className={KBD_BASE}>L</kbd>} label="Create new list" />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>M</kbd>} label="Mark all tasks incomplete" />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>B</kbd>} label="Move completed tasks to bottom" />

                    <ShortcutRow
                      keys={<kbd className={KBD_BASE}>J</kbd>}
                      label="Focus the next task’s checkbox (list order)"
                    />
                    <ShortcutRow
                      keys={<kbd className={KBD_BASE}>K</kbd>}
                      label="Focus the previous task’s checkbox (list order)"
                    />
                    <ShortcutRow
                      keys={<kbd className={KBD_BASE}>Space</kbd>}
                      label="When a checkbox is focused: toggle done. Or click the row beside the title to highlight a task, then Space toggles that task."
                    />
                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>Shift</kbd>
                          <kbd className={KBD_BASE}>Delete</kbd>
                        </>
                      }
                      label="Delete the highlighted task (same highlight as J / K, or click the row beside the title)"
                    />
                    <ShortcutRow keys={<kbd className={KBD_BASE}>Esc</kbd>} label="Clear task highlight, or blur the new-todo field" />

                    <ShortcutRow
                      keys={
                        <>
                          <kbd className={KBD_BASE}>{modSymbol}</kbd>
                          <kbd className={KBD_BASE}>Enter</kbd>
                        </>
                      }
                      label="Submit new todo (while the new-todo field is focused)"
                    />
                  </div>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal.Root>
      ) : null}

      <PaymentModal />
    </>
  );
}
