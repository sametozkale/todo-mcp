import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy route — notes use All only, not a Today list. */
export default function NotesTodayRedirectPage() {
  redirect("/notes/all");
}
