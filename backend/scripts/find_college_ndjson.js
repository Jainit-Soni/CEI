
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

async function findCollege(id) {
    const gzPath = path.join(__dirname, '..', 'data', 'colleges.ndjson.gz');
    const inputStream = fs.createReadStream(gzPath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.id === id || obj._id === id || obj.institution_id === id) {
                console.log(JSON.stringify(obj, null, 2));
                return;
            }
        } catch (e) {}
    }
    console.log("Not found");
}

findCollege(process.argv[2]);
