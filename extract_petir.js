const fs = require('fs');

async function extractData() {
    try {
        console.log("Mengambil data petir dari API lokal...");
        // Tanpa maxDays, agar menarik semua data petir
        const res = await fetch("http://localhost:3000/api/page-data?page=/asset-maps");
        const json = await res.json();

        let petirSheet = json.sheets.find(s => s.sheetName && s.sheetName.toUpperCase().includes("PETIR"));
        if (!petirSheet && json.sheets.length > 1) {
            petirSheet = json.sheets[1]; // default fallback
        }

        if (!petirSheet || !petirSheet.rows) {
            console.log("Data petir tidak ditemukan di API.");
            return;
        }

        console.log(`Ditemukan ${petirSheet.rows.length} baris petir, menyaring dari 01 Januari 2026...`);

        let filtered = [];
        let limitDate = new Date("2026-01-01T00:00:00");

        const headers = petirSheet.headers || Object.keys(petirSheet.rows[0]);
        let timeKey = headers.find(h => h.toLowerCase().includes("time") || h.toLowerCase().includes("tanggal") || h.toLowerCase().includes("date") || h.toLowerCase().includes("waktu"));
        if (!timeKey) timeKey = headers[0];

        filtered = petirSheet.rows.filter(row => {
            const rowDate = new Date(row[timeKey]);
            return rowDate >= limitDate;
        });

        console.log(`Berhasil menyaring ${filtered.length} sambaran petir sejak 1 Januari 2026.`);

        // Buat file CSV
        const csvRows = [];
        csvRows.push(headers.join(","));
        for (const row of filtered) {
            const values = headers.map(h => {
                let val = row[h] !== null && row[h] !== undefined ? String(row[h]) : "";
                val = val.replace(/"/g, '""'); // escape quotes
                return `"${val}"`;
            });
            csvRows.push(values.join(","));
        }

        fs.writeFileSync("d:\\TES\\Rekap_Petir_01Jan_Sekarang.csv", csvRows.join("\n"));
        console.log("Selesai! File disimpan di d:\\TES\\Rekap_Petir_01Jan_Sekarang.csv");
    } catch (e) {
        console.error("Gagal mendapatkan data:", e);
    }
}
extractData();
