const fs = require('fs');
const mammoth = require('mammoth');

async function extract() {
    try {
        console.log("Extracting docx...");
        const result = await mammoth.extractRawText({ path: "Tugas Metopen Proposal Thesis DEWI SETYAHARINI.docx" });
        fs.writeFileSync("user_proposal.txt", result.value);
        console.log("Docx extraction complete.");
    } catch (e) {
        console.error("Docx error:", e);
    }
}
extract();
