const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extract() {
    try {
        const dataBuffer = fs.readFileSync('THI_Assessment_Report_v1.3.pdf');
        const data = await pdfParse(dataBuffer);
        fs.writeFileSync('THI_report_text.txt', data.text);
        console.log('Done. Pages:', data.numpages);
        console.log('Lines:', data.text.split('\n').length);
        // Print first 3000 chars to see structure
        console.log('\n--- PREVIEW ---\n');
        console.log(data.text.substring(0, 3000));
    } catch(e) {
        console.error('Error:', e.message);
    }
}
extract();
