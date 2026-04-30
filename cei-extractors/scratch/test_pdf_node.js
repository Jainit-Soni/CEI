const { PDFParse } = require('pdf-parse/node');
const fs = require('fs');

async function test() {
    const buffer = fs.readFileSync('e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/files/06__2025__result__ROUND_2__Final_Result_for_Round_2_of_UG_Counselling_2025.pdf');
    try {
        const parser = new PDFParse();
        const data = await parser.parse(buffer);
        console.log('Success!', data.text.slice(0, 500));
    } catch (e) {
        console.log('Failed:', e.message);
    }
}
test();
