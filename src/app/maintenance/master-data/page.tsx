import { redirect } from "next/navigation";

/**
 * Legacy route redirect: /maintenance/master-data → /maintenance/dashboard-data
 */
export default function MasterDataRedirect() {
    redirect("/maintenance/dashboard-data");
}
