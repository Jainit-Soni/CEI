const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
if (typeof pdf === 'object') {
    console.log('Keys:', Object.keys(pdf));
}

// Try calling it if it's a function or has a main function
async function test() {
    const fs = require('fs');
    const buffer = fs.readFileSync('e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/files/06__2025__result__ROUND_2__Final_Result_for_Round_2_of_UG_Counselling_2025.pdf');
    
    try {
        const data = await (typeof pdf === 'function' ? pdf(buffer) : pdf.PDFParse ? pdf.PDFParse(buffer) : null);
        console.log('Success!', data.text.slice(0, 100));
    } catch (e) {
        console.log('Failed:', e.message);
    }
}
test();
