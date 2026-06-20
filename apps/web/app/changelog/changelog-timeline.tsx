import Image from "next/image";
import { GraduationCap, NotebookText } from "lucide-react";

type ChangelogEntry = {
  id: string;
  dateLabel: string;
  dateTime: string;
  title: string;
  summary: string;
  bullets: readonly string[];
  isLatest?: boolean;
  marker: "apple" | "yalp" | "student" | "notes";
  metadataImageSrc?: string;
};

const ENTRIES: readonly ChangelogEntry[] = [
  {
    id: "notes-module",
    dateLabel: "June 2026",
    dateTime: "2026-06-20",
    title: "Introducing Notes",
    summary:
      "Not everything belongs on a todo list. Notes is a dedicated space for ideas, drafts, and reference, organized in folders, separate from your tasks, with the same fast Yalp workflow.",
    isLatest: true,
    marker: "notes",
    bullets: [
      "Switch between Todos and Notes from the header: one account, two modes.",
      "Keep notes in folders you create, rename, and reorder alongside All.",
      "Open any note for a focused detail view with room for a full description.",
      "Move, duplicate, and delete with the same menus and keyboard shortcuts as Todos.",
    ],
  },
  {
    id: "students-free",
    dateLabel: "April 2026",
    dateTime: "2026-04-30",
    title: "Yalp is free for students",
    summary: "Students can now use Yalp completely free.",
    isLatest: false,
    marker: "student",
    bullets: [
      "Student access is now fully free.",
      "All core planning features stay included.",
    ],
  },
  {
    id: "macos-app",
    dateLabel: "April 2026",
    dateTime: "2026-04-01",
    title: "Yalp AI for macOS",
    summary:
      "Shipped a native desktop app so you can keep Yalp in its own window—same account, same lists, fewer tabs.",
    isLatest: false,
    marker: "apple",
    metadataImageSrc: "/yalp-ai-macos-update.png",
    bullets: [
      "You can install Yalp on Mac and open it in a dedicated app window.",
      "The desktop experience feels faster and cleaner for daily planning.",
      "Your lists stay in sync between web and Mac app with the same account.",
    ],
  },
  {
    id: "initial-launch",
    dateLabel: "Early 2026",
    dateTime: "2026-01-15",
    title: "Yalp AI is live",
    summary:
      "First public release of Yalp: a focused todo workspace you can drive from the browser and from MCP-ready tools.",
    marker: "yalp",
    metadataImageSrc: "/metadata-yalp.png",
    bullets: [
      "Yalp launched with a clean workspace for lists, todos, and due dates.",
      "You can manage tasks from the web and from compatible AI tools in one flow.",
      "The product focused on reducing context switching from day one.",
    ],
  },
];

export function ChangelogTimeline() {
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <ol className="relative m-0 list-none space-y-0 p-0">
        {ENTRIES.map((entry, index) => {
          const isLast = index === ENTRIES.length - 1;
          return (
            <li key={entry.id} className="relative flex gap-4 pb-12 last:pb-0 sm:gap-5 sm:pb-14">
              <div className="relative flex shrink-0 flex-col items-center">
                <div
                  className="relative z-[1] flex h-9 w-9 items-center justify-center rounded-full border border-[#ececf2] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  aria-hidden
                >
                  {entry.marker === "apple" ? (
                    <span className="text-[17px] leading-none text-[#181925]"></span>
                  ) : entry.marker === "student" ? (
                    <GraduationCap className="h-[17px] w-[17px] text-[#181925]" strokeWidth={1.9} />
                  ) : entry.marker === "notes" ? (
                    <NotebookText className="h-[17px] w-[17px] text-[#181925]" strokeWidth={1.9} />
                  ) : (
                    <Image
                      src="/to-do-mcp-logo-black-48.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  )}
                </div>
                {isLast ? null : (
                  <span
                    className="mt-1 mb-[-40px] w-px flex-1 min-h-[32px] bg-[#ececf2] sm:mb-[-48px] sm:min-h-[40px]"
                    aria-hidden
                  />
                )}
              </div>

              <article className="min-w-0 flex-1 rounded-2xl border border-[#ebebeb] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6 sm:py-6">
                {entry.metadataImageSrc ? (
                  <div className="mb-4 overflow-hidden rounded-[8px]">
                    <Image
                      src={entry.metadataImageSrc}
                      alt={`${entry.title} metadata visual`}
                      width={640}
                      height={336}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <time
                    dateTime={entry.dateTime}
                    className="font-title text-[12px] font-medium uppercase tracking-[0.08em] text-[#8a8e99]"
                  >
                    {entry.dateLabel}
                  </time>
                  {entry.isLatest ? (
                    <span className="rounded-full bg-[#e8f7fc] px-2 py-0.5 font-title text-[11px] font-semibold text-[#0078a8]">
                      Latest
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 font-title text-[22px] font-medium leading-[28px] tracking-[-0.02em] text-[#181925] sm:text-[24px] sm:leading-[30px]">
                  {entry.title}
                </h2>
                <p className="mt-2 font-title text-[14px] leading-[22px] tracking-[-0.01em] text-[#5c5c66]">
                  {entry.summary}
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-5 font-title text-[14px] leading-[21px] tracking-[-0.01em] text-[#5c5c66] marker:text-[#00b5e9]">
                  {entry.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
