import { redirect } from "next/navigation";

/**
 * Serverless Hub — Root redirect to default service.
 * Same pattern as worker-sync/page.tsx.
 */
export default function ServerlessHubRoot() {
    redirect("/serverless-hub/spreadsheet-sync");
}
