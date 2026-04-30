const pdf = require('pdf-parse');
console.log('Type of pdf:', typeof pdf);
console.log('Keys of pdf:', Object.keys(pdf));
if (typeof pdf !== 'function' && pdf.default) {
    console.log('Type of pdf.default:', typeof pdf.default);
}
