const fs = require("fs");
const validIds = JSON.parse(fs.readFileSync("valid_ids.json", "utf8"));

const terms = [
    "Bhopal",
    "Jindal",
    "NLU",
    "National Law",
    "Symbiosis",
    "Manipal"
];

const matches = {};

terms.forEach(term => {
    validIds.forEach(c => {
        if (c.id.toLowerCase().includes(term.toLowerCase()) ||
            c.name.toLowerCase().includes(term.toLowerCase()) ||
            c.shortName.toLowerCase().includes(term.toLowerCase())) {

            if (!matches[term]) matches[term] = [];
            matches[term].push(c.id);
        }
    });
});

console.log(JSON.stringify(matches, null, 2));
