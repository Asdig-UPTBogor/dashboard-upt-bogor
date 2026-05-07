const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('THI_Assessment_Report_v1.3.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('THI_report_text.txt', data.text);
    console.log('Done! Pages:', data.numpages, '| Chars:', data.text.length);
    console.log('\n--- PREVIEW HALAMAN 1-3 ---\n');
    console.log(data.text.substring(0, 6000));
}).catch(e => console.error('Error:', e.message));
