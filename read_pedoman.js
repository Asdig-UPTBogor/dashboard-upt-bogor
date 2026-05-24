const fs = require('fs');
const pdfLib = require('pdf-parse');

const pdf = typeof pdfLib === 'function' ? pdfLib : (pdfLib.default || pdfLib.pdf || Object.values(pdfLib).find(x => typeof x === 'function'));

const filePath = 'd:\\TES\\dashboard-upt-bogor\\Pedoman-Penulisan-Usulan-Penelitian-utk-Tesis-1.pdf';
let dataBuffer = fs.readFileSync(filePath);

pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(err => {
    console.error("Error reading PDF:", err);
});
