const path = require('path');
const ir = require(path.resolve(__dirname, '../backend/lib/collegeIdentityResolver'));
const id = 'U-0306';
const aliases = ir.getAllAliases(id);
console.log('Aliases for U-0306:', aliases);

const truthRow = { collegeId: 'CORE-IIT-BOMBAY', entityType: 'placement', averagePackage: 21.8 };
const aliasSet = new Set(aliases);

const matches = (aliasSet.has(truthRow.collegeId) || aliasSet.has(truthRow.id) || aliasSet.has(truthRow.stableKey));
console.log('Matches Truth Row?', matches);
