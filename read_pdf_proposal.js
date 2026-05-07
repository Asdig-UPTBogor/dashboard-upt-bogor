const fs = require('fs');
const pdfLib = require('pdf-parse');

// Sometimes default exports vary by version/environment
const pdf = typeof pdfLib === 'function' ? pdfLib : (pdfLib.default || pdfLib.pdf || Object.values(pdfLib).find(x => typeof x === 'function'));

const filePath = 'd:\\\\TES\\\\dashboard-upt-bogor\\\\Tugas Metopen Proposal Thesis DEWI SETYAHARINI.pdf';

let dataBuffer = fs.readFileSync(filePath);

if (typeof pdf !== 'function') {
    console.error("Could not find pdf function in pdf-parse module. Keys:", Object.keys(pdfLib));
    process.exit(1);
}

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => {
    console.error("Error reading PDF:", err);
});
