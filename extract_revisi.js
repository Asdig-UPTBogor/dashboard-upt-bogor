const fs = require('fs');
const mammoth = require('mammoth');

async function extract() {
    try {
        console.log("Extracting docx...");
        const result = await mammoth.extractRawText({path: "Revisi Tesis DEWI SETYAHARINI.docx"});
        fs.writeFileSync("tesis_revisi_terbaru.txt", result.value);
        console.log("Done. Lines:", result.value.split('\n').length);
    } catch(e) {
        console.error("Error:", e);
    }
}
extract();
