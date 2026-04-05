import { redirect } from "next/navigation";

/**
 * Cloud Console — Root redirect to default service.
 * Same pattern as worker-sync/page.tsx.
 */
export default function CloudConsoleRoot() {
    redirect("/cloud-console/spreadsheet-sync");
}
