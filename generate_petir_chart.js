const fs = require('fs');

async function generateChart() {
    try {
        console.log("Mengambil data...");
        const res = await fetch("http://localhost:3000/api/page-data?page=/asset-maps");
        const json = await res.json();

        let petirSheet = json.sheets.find(s => s.sheetName && s.sheetName.toUpperCase().includes("PETIR"));
        if (!petirSheet && json.sheets.length > 1) {
            petirSheet = json.sheets[1];
        }

        let limitDate = new Date("2026-01-01T00:00:00");
        const headers = petirSheet.headers || Object.keys(petirSheet.rows[0]);
        let timeKey = headers.find(h => h.toLowerCase().includes("time") || h.toLowerCase().includes("tanggal") || h.toLowerCase().includes("date") || h.toLowerCase().includes("waktu")) || headers[0];

        let penghantarCounts = {};

        for (const row of petirSheet.rows) {
            const rowDate = new Date(row[timeKey]);
            if (rowDate >= limitDate) {
                // Cari nama tower untuk diekstrak menjadi penghantar
                const towerName = row["nama tower (resolved)"] || row["tower_name_resolved"] || row["tower_name"] || row["TOWER"] || "Unknown";

                // Biasanya format UPT Bogor: "KDBDK-KRCAK T.05" -> Penghantar: "KDBDK-KRCAK"
                // Split berdasarkan spasi T., No., #, dll
                let penghantar = towerName.split(/ T\.| No\.| #| T\d+| Tower/i)[0].trim();
                if (!penghantar || penghantar === "Unknown") penghantar = "Tidak Diketahui";

                penghantarCounts[penghantar] = (penghantarCounts[penghantar] || 0) + 1;
            }
        }

        // Urutkan terbesar
        let sorted = Object.entries(penghantarCounts).sort((a, b) => b[1] - a[1]);

        // Batasi label dan data
        const labels = sorted.map(s => s[0]);
        const data = sorted.map(s => s[1]);

        console.log("Rekap penghantar:", sorted);

        // Generate HTML with Chart.js
        const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grafik Petir per Penghantar (Mulai Jan 2026)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; padding: 20px; }
        .container { max-width: 900px; margin: auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: #333; }
        .total { text-align: center; color: #555; font-weight: bold; margin-bottom: 20px; font-size: 1.2rem; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Rekap Sambaran Petir per Penghantar</h2>
        <div class="total">Total Kejadian Petir: ${data.reduce((a, b) => a + b, 0)} (Sejak 01 Januari 2026)</div>
        <canvas id="petirChart"></canvas>
    </div>
    
    <script>
        Chart.register(ChartDataLabels);
        const ctx = document.getElementById('petirChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Jumlah Sambaran Petir',
                    data: ${JSON.stringify(data)},
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: 'rgba(217, 119, 6, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                layout: { padding: { top: 30 } },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#b45309',
                        font: { weight: 'bold', size: 12 }
                    }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Jumlah Sambaran' } },
                    x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } }
                }
            }
        });
    </script>
</body>
</html>
        `;

        fs.writeFileSync("d:\\TES\\Chart_Petir_Penghantar.html", html);
        console.log("File HTML Grafik berhasil dibuat di d:\\TES\\Chart_Petir_Penghantar.html");

        // Simpan juga versi CSV Rekap
        const csvRekap = "Penghantar,Jumlah Sambaran\n" + sorted.map(s => `"${s[0]}",${s[1]}`).join("\n");
        fs.writeFileSync("d:\\TES\\Rekap_Petir_Per_Penghantar.csv", csvRekap);

    } catch (e) { console.error(e); }
}
generateChart();
