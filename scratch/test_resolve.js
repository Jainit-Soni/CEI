const ie = require('../backend/lib/identityEnforcement');

const names = [
    "National Institute of Technology, Tiruchirappalli",
    "Indian Institute of Information Technology, Allahabad"
];

for (const name of names) {
    console.log(`${name} -> ${ie.resolveCanonicalId(name)}`);
}
