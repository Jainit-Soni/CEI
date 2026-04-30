const pdf = require('pdf-parse');
async function test() {
    const fs = require('fs');
    const buffer = fs.readFileSync('e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/files/06__2025__result__ROUND_2__Final_Result_for_Round_2_of_UG_Counselling_2025.pdf');
    try {
        const parser = new pdf.PDFParse();
        const data = await parser.parse(buffer);
        console.log('Success!', data.text.slice(0, 500));
    } catch (e) {
        console.log('Failed:', e.message);
        // Try another way
        try {
            const data = await pdf.PDFParse(buffer); // No new? but it said class constructor
        } catch (e2) {
             console.log('Failed 2:', e2.message);
        }
    }
}
test();
