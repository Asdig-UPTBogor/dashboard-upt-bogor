import { NextResponse } from "next/server";
import { fetchAllSheets } from "@/lib/sheets";

// Cache: 5 min — Overview data ULTG/GI/BAY (see dashboard-config.ts)
export const revalidate = 300;

export async function GET() {
    try {
        const data = await fetchAllSheets();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Sheets API error:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}
