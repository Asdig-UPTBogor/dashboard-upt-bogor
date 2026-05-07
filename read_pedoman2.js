const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync('./pedoman_text.txt', pdfParser.getRawTextContent());
    console.log("PDF extraction done.");
});

pdfParser.loadPDF('d:\\TES\\dashboard-upt-bogor\\Pedoman-Penulisan-Usulan-Penelitian-utk-Tesis-1.pdf');
