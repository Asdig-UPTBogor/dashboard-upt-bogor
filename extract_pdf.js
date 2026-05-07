const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('Pedoman-Penulisan-Usulan-Penelitian-utk-Tesis-1.pdf');

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('pedoman_extracted.txt', data.text);
    console.log("PDF extraction complete.");
}).catch(console.error);
