/** Instant shell while navigating between /all, /today, and list routes (RSC fetch). */
export default function AppSegmentLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6" aria-busy="true" aria-label="Loading list">
      <div className="mb-5 h-9 w-full max-w-md animate-pulse rounded-[12px] bg-[#ececec]" />
      <div className="mb-4 h-12 w-full animate-pulse rounded-[16px] bg-[#ececec]" />
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="h-12 w-full animate-pulse rounded-[16px] bg-[#f0f0f0]" />
        ))}
      </ul>
    </div>
  );
}
