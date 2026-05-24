import { NextResponse } from "next/server";
import { getGoogleAuth } from "@/lib/dashboard-config";

const SUPA_URL = "https://mjgekmjnsipthcswazid.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZ2VrbWpuc2lwdGhjc3dhemlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTk5MjEsImV4cCI6MjA5Mjk3NTkyMX0.NUccEhwKNd7-09pTcfIZt2s8cL8bj-eQOuVt7hDMb1k";
const BQ_PROJECT = "gcp-bridge-meshvpn";

async function benchSupa() {
    const start = Date.now();
    const res = await fetch(
        `${SUPA_URL}/rest/v1/rpc/`,
        {
            method: "POST",
            headers: {
                apikey: SUPA_KEY,
                Authorization: `Bearer ${SUPA_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        }
    );

    const queries = [
        {
            name: "thor.strikes (500 rows)",
            url: `${SUPA_URL}/rest/v1/strikes?select=*&limit=500&order=event_time.desc`,
            schema: "thor",
        },
        {
            name: "weather forecast (1000 rows)",
            url: `${SUPA_URL}/rest/v1/om_forecast_hourly?select=*&limit=1000`,
            schema: "weather_open_meteo",
        },
        {
            name: "tower_assets (all ~1637 rows)",
            url: `${SUPA_URL}/rest/v1/tower_assets?select=*`,
            schema: "thor",
        },
    ];

    const results = [];
    for (const q of queries) {
        const t0 = Date.now();
        const r = await fetch(q.url, {
            headers: {
                apikey: SUPA_KEY,
                Authorization: `Bearer ${SUPA_KEY}`,
                Accept: "application/json",
                "Accept-Profile": q.schema,
            },
        });
        const data = await r.json();
        const ms = Date.now() - t0;
        results.push({
            name: q.name,
            rows: Array.isArray(data) ? data.length : 0,
            ms,
            status: r.status,
        });
    }
    return results;
}

async function benchBQ() {
    const scopes = ["https://www.googleapis.com/auth/bigquery"];
    const auth = getGoogleAuth(scopes);
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token || "";

    const queries = [
        {
            name: "n_MASTER_ASSET_TOWER (all rows)",
            sql: "SELECT * FROM `gcp-bridge-meshvpn.Master_Transmisi_UPT_Bogor.n_MASTER_ASSET_TOWER`",
        },
        {
            name: "n_3_PROTEKSI_PETIR (all rows)",
            sql: "SELECT * FROM `gcp-bridge-meshvpn.Master_Transmisi_UPT_Bogor.n_3_PROTEKSI_PETIR_TAMBAHAN`",
        },
        {
            name: "n_MTU_TRAFO (all rows)",
            sql: "SELECT * FROM `gcp-bridge-meshvpn.Dashboard_Gardu_Induk_UPT_Bogor.n_MTU_TRAFO`",
        },
    ];

    const results = [];
    for (const q of queries) {
        const t0 = Date.now();
        const res = await fetch(
            `https://bigquery.googleapis.com/bigquery/v2/projects/${BQ_PROJECT}/queries`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: q.sql,
                    useLegacySql: false,
                    location: "asia-southeast2",
                }),
            }
        );
        const data = await res.json();
        const ms = Date.now() - t0;
        results.push({
            name: q.name,
            rows: data.totalRows ? parseInt(data.totalRows) : 0,
            ms,
            status: res.status,
        });
    }
    return results;
}

export async function GET() {
    const region = process.env.VERCEL_REGION || "local";
    const t0 = Date.now();

    const [supa, bq] = await Promise.all([
        benchSupa().catch((e) => [{ name: "ERROR", ms: 0, rows: 0, status: 500, error: String(e) }]),
        benchBQ().catch((e) => [{ name: "ERROR", ms: 0, rows: 0, status: 500, error: String(e) }]),
    ]);

    return NextResponse.json({
        region,
        total_ms: Date.now() - t0,
        supabase: { results: supa, total_ms: supa.reduce((a, b) => a + b.ms, 0) },
        bigquery: { results: bq, total_ms: bq.reduce((a, b) => a + b.ms, 0) },
    });
}
