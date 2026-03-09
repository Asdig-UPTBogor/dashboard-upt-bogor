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
        const info = await client.spreadsheets.get({ spreadsheetId });
        const sheet = info.data.sheets.find(s => s.properties.title === sheetTitle);

        if (!sheet) {
            console.error("Sheet not found");
            return;
        }

        const sheetId = sheet.properties.sheetId;

        const requests = [
            // Apply banding (alternating row colors) to rows 1 to 1000
            {
                addBanding: {
                    bandedRange: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 1, // Skip header
                            endRowIndex: 1000,
                            startColumnIndex: 0,
                            endColumnIndex: 4
                        },
                        rowProperties: {
                            firstBandColorStyle: { rgbColor: { red: 1, green: 1, blue: 1 } }, // White
                            secondBandColorStyle: { rgbColor: { red: 0.96, green: 0.96, blue: 0.98 } }, // Very light grey/blue
                        }
                    }
                }
            },
            // Align all data rows to the middle
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: 1,
                        endRowIndex: 1000,
                        startColumnIndex: 0,
                        endColumnIndex: 4
                    },
                    cell: {
                        userEnteredFormat: {
                            verticalAlignment: "MIDDLE",
                            textFormat: {
                                fontFamily: "Arial",
                                fontSize: 10
                            }
                        }
                    },
                    fields: "userEnteredFormat(verticalAlignment,textFormat)"
                }
            }
        ];

        // We wrap in try block, because adding banding twice causes error.
        // It's safer to clear banded items first if we wanted to make this idempotent,
        // but for a one-off run it's fine.
        console.log(`Applying advanced formatting to ${sheetTitle}...`);
        await client.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });

        console.log("Success! Spreadsheet looks enterprise grade.");

    } catch (e) {
        console.error("Failed to apply advanced formatting (banding may already exist):", e.message);
    }
}
run();
