const fs = require('fs-extra');
const pdfParse = require('pdf-parse');

async function main() {
    const pdfPath = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/files/06__2025__result__ROUND_2__Final_Result_for_Round_2_of_UG_Counselling_2025.pdf';
    const buffer = await fs.readFile(pdfPath);
    const parsed = await pdfParse(buffer);
    console.log(parsed.text.slice(0, 5000));
}

main().catch(console.error);
