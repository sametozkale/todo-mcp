"use client";

import { updateProfileAction } from "@/app/(app)/profile/actions";
import { ToDoMcpLogo } from "@/components/brand/to-do-mcp-logo";
import { createClient } from "@/lib/supabase/client";
import { Logout02Icon, McpServerIcon, ProfileIcon } from "@hugeicons/core-free-icons";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";

const DEFAULT_AVATAR_SRC =
  "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg";

const ACCOUNT_TRIGGER_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[#00b5e9]";

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
  const profileModal = useOverlayState();
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

  return (
    <>
      <header className="sticky top-0 z-10">
        <div className="flex h-14 w-full items-center justify-between gap-3 px-12">
          <Link href="/today" className="inline-flex shrink-0 items-center no-underline">
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
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu className="w-[180px]">
                  <Dropdown.Item
                    onAction={() => profileModal.open()}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={ProfileIcon} size={16} strokeWidth={1.75} />
                      <span>Profile</span>
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
                <Dropdown.Item onAction={handleLogout}>
                    <span className="inline-flex items-center gap-2">
                      <HugeiconsIcon icon={Logout02Icon} size={16} strokeWidth={1.75} />
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
    </>
  );
}
