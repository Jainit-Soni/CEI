const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

// District Centroids (Simplified for Major Academic Hubs)
const DISTRICT_CENTROIDS = {
    "pune|maharashtra": { lat: 18.5204, lng: 73.8567 },
    "mumbai|maharashtra": { lat: 19.0760, lng: 72.8777 },
    "bengaluru|karnataka": { lat: 12.9716, lng: 77.5946 },
    "chennai|tamil nadu": { lat: 13.0827, lng: 80.2707 },
    "hyderabad|telangana": { lat: 17.3850, lng: 78.4867 },
    "lucknow|uttar pradesh": { lat: 26.8467, lng: 80.9462 },
    "jaipur|rajasthan": { lat: 26.9124, lng: 75.7873 },
    "ahmedabad|gujarat": { lat: 23.0225, lng: 72.5714 },
    "delhi|delhi": { lat: 28.6139, lng: 77.2090 },
    "bhopal|madhya pradesh": { lat: 23.2599, lng: 77.4126 },
    "chandigarh|chandigarh": { lat: 30.7333, lng: 76.7794 },
    "kolkata|west bengal": { lat: 22.5726, lng: 88.3639 },
    "patna|bihar": { lat: 25.5941, lng: 85.1376 },
};

async function globalDistrictGeocode() {
    console.log("🌍 Starting GLOBAL DISTRICT GEOCODING (67,209 Institutions)...");

    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let geoCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        
        if (!college.coordinates) {
            const dKey = ((college.district || '') + '|' + (college.state || '')).toLowerCase();
            
            if (DISTRICT_CENTROIDS[dKey]) {
                college.coordinates = DISTRICT_CENTROIDS[dKey];
                college.meta = college.meta || {};
                college.meta.locationPrecision = "district-centroid";
                geoCount++;
            } else {
                // Generic state centroid fallback (Very low precision)
                // This will be expanded in Wave 5.2
            }
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`✅ Global Geocoding Wave 1 Finished! Mapped ${geoCount} institutions to District Centroids.`);
}

globalDistrictGeocode().catch(console.error);
