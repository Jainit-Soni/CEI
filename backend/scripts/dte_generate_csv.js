const fs = require('fs');
const readline = require('readline');
const path = require('path');

const inputHtml = path.join(__dirname, '../../tmp/test_curl.html');
const outCsv = path.join(__dirname, '../data/maharashtra_dte_master_list.csv');

function parseHTMl() {
    const html = fs.readFileSync(inputHtml, 'utf-8');
    
    // Quick regex to extract rows from the main table
    // Example: <td class="Header" align="center" width="7%">3.</td><td class="Item" align="center" width="7%"><a href="frmInstituteSummary.aspx?InstituteCode=01105">01105</a></td><td class="Item" align="left" width="65%">Prof. Ram Meghe Institute of Technology &amp; Research, Amravati</td><td class="Item" align="center" width="14%">Un-Aided, Autonomous</td><td class="Item" align="center" width="7%">840</td>
    
    const trRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let match;
    const records = [];
    
    while ((match = trRegex.exec(html)) !== null) {
        const rowHtml = match[1];
        if (rowHtml.includes('InstituteCode=')) {
            // It's a valid data row
            const codeMatch = rowHtml.match(/InstituteCode=([^"]+)">([^<]+)<\/a>/);
            const rawCode = codeMatch ? codeMatch[2].trim() : null;
            
            // Extract the 3rd td which has the name
            const tds = [];
            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let tdMatch;
            while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
                // Remove HTML tags except inside, wait just strip tags
                let content = tdMatch[1].replace(/<[^>]+>/g, '').trim();
                // unescape html entities
                content = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                tds.push(content);
            }
            
            if (rawCode && tds.length >= 5) {
                // Typical table: [ '3.', '01105', 'Prof. Ram Meghe Institute...', 'Un-Aided, Autonomous', '840' ]
                const name = tds[2].replace(/"/g, '""');
                const status = tds[3].replace(/"/g, '""');
                
                // Try to isolate district/city from the end of the name if possible, usually separated by comma
                let pureName = name;
                let city = "";
                const commaParts = name.split(',');
                if (commaParts.length > 1) {
                    city = commaParts[commaParts.length - 1].trim();
                    // Don't modify the raw original name though as per instructions, well maybe just store it
                }
                
                records.push(`"${rawCode}","${name}","${city}","Maharashtra","${status}"`);
            }
        }
    }
    
    const header = `"dte_code","official_institute_name","city","state","status"`;
    fs.writeFileSync(outCsv, header + "\n" + records.join("\n"));
    console.log("CSV Generated:", records.length, "rows.");
}

parseHTMl();
