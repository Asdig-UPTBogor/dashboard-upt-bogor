const { google } = require('googleapis');
const path = require('path');

const credentialsPath = path.join(__dirname, '../../../Google Auth/automaticspreadsheet-de108e1d5b56.json');
const spreadsheetId = '1vpVUczVs8GB-VHbqxrHpl-EZI66HO2e2fWdU3qfLzeI';
const sheetTitle = 'Master Gardu Induk';

async function protectAndAnnotate() {
    console.log("Applying SOFT Iron Gate to", sheetTitle, "...");
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const meta = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties(sheetId,title),protectedRanges)',
        });
        
        const sheet = meta.data.sheets.find(s => s.properties.title === sheetTitle);
        if (!sheet) throw new Error(`Sheet ${sheetTitle} not found`);
        const sheetId = sheet.properties.sheetId;

        const existingProtections = sheet.protectedRanges || [];
        const clearRequests = existingProtections.map(pr => ({
            deleteProtectedRange: { protectedRangeId: pr.protectedRangeId }
        }));

        if (clearRequests.length > 0) {
             await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: clearRequests }
            });
            console.log("Cleared strict protections.");
        }

        const requests = [];

        // SOFT Protection request
        requests.push({
            addProtectedRange: {
                protectedRange: {
                    range: {
                        sheetId: sheetId,
                    },
                    description: "DASHBOARD CMS LOCK: Structure & Headers",
                    warningOnly: true, // SOFT LOCK
                    unprotectedRanges: [
                        {
                            sheetId: sheetId,
                            startRowIndex: 1 
                        }
                    ]
                }
            }
        });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });

        console.log("Success! SOFT Iron Gate Applied. Editors can edit with a warning.");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

protectAndAnnotate();
