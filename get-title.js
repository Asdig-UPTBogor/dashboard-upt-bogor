const { google } = require('googleapis');
const path = require('path');

async function getTitle() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/Google Auth/automaticspreadsheet-de108e1d5b56.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // The spreadsheet ID from the user
    const spreadsheetId = '1wh2ckkEaovH2MueQDXEG1u7HDenry5_D37JpdvqNWak';

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title',
    });

    console.log("TITLE:", response.data.properties.title);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

getTitle();
