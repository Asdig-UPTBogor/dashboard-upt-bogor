const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const outputFile = path.join(__dirname, 'public', 'fault_locator.json');

// URL for Google Sheet: 10.JARAK SPAN
const CSV_URL = 'https://docs.google.com/spreadsheets/d/13xm0SqMP5EYbLyYnt5jUPUx1BzhaDffkX4iippq_LuM/export?format=csv&gid=1074388355';

async function main() {
    console.log('Fetching data from Google Sheets...');
    const response = await fetch(CSV_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const csvText = await response.text();
    
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data;
    
    console.log(`Found ${rows.length} rows in the Google Sheet.`);
    
    // Group by PENGHANTAR
    let allData = {};
    for (const row of rows) {
        const rawPenghantar = row['PENGHANTAR'];
        if (!rawPenghantar) continue; // Skip empty rows
        
        if (!allData[rawPenghantar]) {
            allData[rawPenghantar] = [];
        }
        allData[rawPenghantar].push(row);
    }
    
    // Special logic: PELABUHAN RATU-CIBADAK BARU shares towers 1-85 with PELABUHAN RATU-SEMEN JAWA
    if (allData['SUTT 150 kV PELABUHAN RATU-CIBADAK BARU'] && allData['SUTT 150 kV PELABUHAN RATU-SEMEN JAWA']) {
        const smnjw = allData['SUTT 150 kV PELABUHAN RATU-SEMEN JAWA'];
        // Copy ordering 1 to 85, change their PENGHANTAR name so it groups correctly if needed, though they are already pushed to the CBDRU array
        const smnjw85 = smnjw
            .filter(r => parseInt(r['ORDERING']) >= 1 && parseInt(r['ORDERING']) <= 85)
            .map(r => ({ ...r, PENGHANTAR: 'SUTT 150 kV PELABUHAN RATU-CIBADAK BARU' }));
        
        // Remove any existing rows in CBDRU with ordering <= 85 (to avoid clashes with the huge 11M data or 0s)
        let cbdru = allData['SUTT 150 kV PELABUHAN RATU-CIBADAK BARU'].filter(r => parseInt(r['ORDERING']) > 85);
        
        // Add the 85 towers to CBDRU
        allData['SUTT 150 kV PELABUHAN RATU-CIBADAK BARU'] = smnjw85.concat(cbdru);
    }

    const result = [];
    
    for (const penghantar in allData) {
        const data = allData[penghantar];
        // Ensure sorted by ordering
        data.sort((a, b) => (parseFloat(a['ORDERING']) || 0) - (parseFloat(b['ORDERING']) || 0));

        // Determine the source GI from the Penghantar name
        const giNames = penghantar.split('-');
        let sourceGi = giNames[0];
        // Clean out prefix like "SUTT 150 kV " to get pure GI name
        sourceGi = sourceGi.replace(/SUTT \d+ kV /i, '').replace(/SUTET \d+ kV /i, '').replace(/SKTT \d+ kV /i, '').trim();

        let cumulativeMeters = 0;
        const segments = [];

        for (const row of data) {
            if (!row['LOKASI X'] || row['LOKASI X'].trim() === '') continue;

            let jarak = parseFloat((row['JARAK (m)'] || "0").toString().replace(',', '.'));
            if (isNaN(jarak)) jarak = 0;

            cumulativeMeters += jarak;

            segments.push({
                ordering: parseInt(row['ORDERING']) || 0,
                towerX: row['LOKASI X'].trim(),
                span: (row['SPAN'] || "").trim(),
                towerY: (row['LOKASI Y'] || "").trim(),
                jarakMeters: jarak,
                cumulativeKm: cumulativeMeters / 1000
            });
        }

        if (segments.length > 0) {
            result.push({
                penghantar: penghantar,
                sourceGi: sourceGi,
                totalLengthKm: cumulativeMeters / 1000,
                segments: segments
            });
        }
    }

    result.sort((a, b) => a.penghantar.localeCompare(b.penghantar));

    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`Processed ${result.length} unique penghantar and saved to ${outputFile}`);
}

main().catch(console.error);
