import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets-api";

export async function GET() {
    try {
        const client = await getSheetsClient();
        const spreadsheetId = "13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM";
        
        const res = await client.spreadsheets.values.get({
            spreadsheetId,
            range: "22. TEBANG PANGKAS!1:3",
        });
        
        return NextResponse.json({
            headers: res.data.values?.[0] || [],
            row2: res.data.values?.[1] || [],
            row3: res.data.values?.[2] || [],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
