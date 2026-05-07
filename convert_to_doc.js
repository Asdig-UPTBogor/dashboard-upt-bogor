const fs = require('fs');

try {
    const textPath = 'd:\\TES\\dashboard-upt-bogor\\proposal_text.txt';
    const outPath = 'd:\\TES\\Proposal_Asli_Dewi_Setyaharini.doc';
    const text = fs.readFileSync(textPath, 'utf8');

    // Encapsulate the raw text in an HTML structure that MS Word understands natively
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><title>Proposal Asli</title></head>
<body>
<div style="font-family: 'Times New Roman', serif; font-size: 12pt; text-align: justify; white-space: pre-wrap;">
${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</div>
</body>
</html>`;

    fs.writeFileSync(outPath, html, 'utf8');
    console.log("Successfully created", outPath);
} catch (e) {
    console.error("Error creating doc:", e);
}
