const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync('./proposal_text.txt', pdfParser.getRawTextContent());
    console.log("PDF extraction done.");
});

pdfParser.loadPDF('d:\\\\TES\\\\dashboard-upt-bogor\\\\Tugas Metopen Proposal Thesis DEWI SETYAHARINI.pdf');
