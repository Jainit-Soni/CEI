const { getColleges } = require("./services/dataStore");
const fs = require("fs");

const colleges = getColleges();
const ids = colleges.map(c => ({ id: c.id, name: c.name, shortName: c.shortName, location: c.location }));

fs.writeFileSync("valid_ids.json", JSON.stringify(ids, null, 2));
console.log(`Dumped ${ids.length} IDs.`);
