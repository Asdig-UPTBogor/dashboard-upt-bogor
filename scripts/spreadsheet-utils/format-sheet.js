const { google } = require("googleapis");

const keyPath = "../../../Google Auth/automaticspreadsheet-de108e1d5b56.json";

async function run() {
    const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = google.sheets({ version: "v4", auth });
    const spreadsheetId = "1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI";
    const sheetTitle = "Master Gardu Induk";

    try {
        console.log(`Fetching info for spreadsheet ${spreadsheetId}...`);
        const info = await client.spreadsheets.get({ spreadsheetId });
        console.log("Available sheets:", info.data.sheets.map(s => s.properties.title).join(", "));

        const sheet = info.data.sheets.find(s => s.properties.title === sheetTitle);

        if (!sheet) {
            console.error("Sheet not found:", sheetTitle);
            return;
        }

        const sheetId = sheet.properties.sheetId;
        console.log(`Found sheet '${sheetTitle}' with ID: ${sheetId}. Applying formatting...`);

        const requests = [
            // Freeze row 1
            {
                updateSheetProperties: {
                    properties: {
                        sheetId: sheetId,
                        gridProperties: {
                            frozenRowCount: 1
                        }
                    },
                    fields: "gridProperties.frozenRowCount"
                }
            },
            // Style Header Row (A to D)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: 0,
                        endRowIndex: 1,
                        startColumnIndex: 0,
                        endColumnIndex: 4
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColorStyle: {
                                rgbColor: { red: 0.1, green: 0.2, blue: 0.35 } // Dark blue
                            },
                            textFormat: {
                                foregroundColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } }, // White text
                                bold: true,
                                fontFamily: "Arial",
                                fontSize: 11
                            },
                            horizontalAlignment: "CENTER",
                            verticalAlignment: "MIDDLE",
                            borders: {
                                bottom: { style: "SOLID_MEDIUM", colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                                top: { style: "SOLID", colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                                left: { style: "SOLID", colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } },
                                right: { style: "SOLID", colorStyle: { rgbColor: { red: 0, green: 0, blue: 0 } } }
                            }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColorStyle,textFormat,horizontalAlignment,verticalAlignment,borders)"
                }
            },
            // Auto resize columns A to D so headers fit nicely
            {
                autoResizeDimensions: {
                    dimensions: {
                        sheetId: sheetId,
                        dimension: "COLUMNS",
                        startIndex: 0,
                        endIndex: 4
                    }
                }
            }
        ];

        await client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests
            }
        });

        console.log("Successfully formatted", sheetTitle);

    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
