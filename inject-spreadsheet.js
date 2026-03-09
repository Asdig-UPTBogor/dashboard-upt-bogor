const fs = require('fs');
const path = require('path');

const configPath = './src/lib/spreadsheet-config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const sheetId = "1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak";

if (!config.spreadsheets.find(s => s.spreadsheetId === sheetId)) {
    config.spreadsheets.push({
        id: "master-data-baru",
        spreadsheetId: sheetId,
        title: "Master Data Hierarchy Baru",
        sheets: [
            {
                sheetName: "Master Gardu Induk",
                label: "Daftar Gardu Induk",
                route: "",
                usedBy: ["/maintenance/master-data"],
                columnsUsed: [
                    { name: "Master ULTG", pos: "" },
                    { name: "Master Gardu Induk", pos: "" },
                    { name: "Status", pos: "" }
                ],
                hierarchyPresent: ["ultg", "gi"],
                hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk" }
            },
            {
                sheetName: "Master Bay",
                label: "Daftar Bay",
                route: "",
                usedBy: ["/maintenance/master-data"],
                columnsUsed: [
                    { name: "Master ULTG", pos: "" },
                    { name: "Master Gardu Induk", pos: "" },
                    { name: "Master Bay", pos: "" }
                ],
                hierarchyPresent: ["ultg", "gi", "bay"],
                hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk", bay: "Master Bay" }
            }
        ]
    });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("Injected spreadsheet.");
} else {
    // If it exists, make sure Master Bay is in it
    const entry = config.spreadsheets.find(s => s.spreadsheetId === sheetId);
    let masterBay = entry.sheets.find(s => s.sheetName === "Master Bay");
    if (!masterBay) {
        entry.sheets.push({
            sheetName: "Master Bay",
            label: "Daftar Bay",
            route: "",
            usedBy: ["/maintenance/master-data"],
            columnsUsed: [
                { name: "Master ULTG", pos: "" },
                { name: "Master Gardu Induk", pos: "" },
                { name: "Master Bay", pos: "" }
            ],
            hierarchyPresent: ["ultg", "gi", "bay"],
            hierarchyMapping: { ultg: "Master ULTG", gi: "Master Gardu Induk", bay: "Master Bay" }
        });
        console.log("Added Master Bay sheet to existing spreadsheet entry.");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } else {
        console.log("Master Bay already exists in spreadsheet entry.");
    }
}
