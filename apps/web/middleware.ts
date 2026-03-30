import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Exclude all Next internals (dev CSS/HMR use paths beyond `_next/static`, e.g. webpack).
  matcher: [
    "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|llms.txt|ai.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
