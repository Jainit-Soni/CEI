const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const REGISTRY_FILE = path.join(__dirname, '..', 'data', 'core', 'master_core_registry.json');

// Central Coordinates for Top Hubs (Fallbacks for Core)
const HUB_COORDS = {
    "Delhi": { lat: 28.6139, lng: 77.2090 },
    "Mumbai": { lat: 19.0760, lng: 72.8777 },
    "Bangalore": { lat: 12.9716, lng: 77.5946 },
    "Chennai": { lat: 13.0827, lng: 80.2707 },
    "Hyderabad": { lat: 17.3850, lng: 78.4867 },
    "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
    "Kolkata": { lat: 22.5726, lng: 88.3639 },
    "Pune": { lat: 18.5204, lng: 73.8567 },
};

async function coreGeocode() {
    console.log("📍 Starting Core Geocoding Wave...");
    const coreRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    const coreCodes = new Set(coreRegistry.map(c => c.aisheCode).filter(Boolean));
    const coreNames = new Set(coreRegistry.map(c => c.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '')));

    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    const updated = collegesLines.map(line => {
        let college = JSON.parse(line);
        const nameKey = college.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isCore = coreCodes.has(college.aisheCode) || coreNames.has(nameKey);

        if (isCore && !college.coordinates) {
            // Attempt state/city hub lookup
            const city = college.district || college.city;
            if (HUB_COORDS[city]) {
                college.coordinates = HUB_COORDS[city];
                college.dataConfidenceScore = (college.dataConfidenceScore || 50) + 10;
            }
        }
        return JSON.stringify(college);
    });

    fs.writeFileSync(COLLEGES_FILE, updated.join('\n') + '\n');
    console.log("✅ Core GPS Fallbacks Injected for Hub-based institutions.");
}

coreGeocode().catch(console.error);
