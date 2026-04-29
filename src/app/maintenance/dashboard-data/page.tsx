import { Table2 } from "lucide-react";
import { DashboardDataClient } from "./_components/DashboardDataClient";

export const metadata = {
    title: "Dashboard Data | UPT Bogor System",
    description: "Browse, view, and edit spreadsheet data connected to the dashboard",
};

export default function DashboardDataPage() {
    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col">
            {/* Header */}
            <div className="flex-none flex items-center gap-3 mb-3">
                <div className="relative">
                    <div className="absolute -inset-1 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-500 opacity-25 blur-lg" />
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-cyan-500">
                        <Table2 className="h-5 w-5 text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="ds-heading text-foreground">
                        Dashboard Data
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Browse and manage all connected spreadsheet data
                    </p>
                </div>
            </div>

            {/* Client content */}
            <div className="flex-1 min-h-0">
                <DashboardDataClient />
            </div>
        </div>
    );
}
