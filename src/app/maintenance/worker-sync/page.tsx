import { redirect } from "next/navigation";

/**
 * Worker Sync — Root redirect to default worker.
 */
export default function WorkerSyncRoot() {
    redirect("/maintenance/worker-sync/spreadsheet-sync");
}
