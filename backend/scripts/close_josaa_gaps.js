const fs = require('fs');
const path = require('path');

const registryPath = 'backend/data/truth/core_id_mapping_batch1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// JoSAA Name Variants identified in Phase 103 Gap Analysis
const josaaGapsMap = {
  "Indian Institute of Technology (BHU) Varanasi": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-BANARAS-HINDU-UNIVERSITY-VARANASI",
  "Birla Institute of Technology, Mesra, Ranchi": "CORE-BIRLA-INSTITUTE-OF-TECHNOLOGY-MESRA-RANCHI",
  "Punjab Engineering College, Chandigarh": "CORE-PUNJAB-ENGINEERING-COLLEGE-CHANDIGARH",
  "Birla Institute of Technology, Patna Off-Campus": "CORE-BIRLA-INSTITUTE-OF-TECHNOLOGY-PATNA",
  "Indian Institute of Technology Bhubaneswar": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-BHUBANESHWAR",
  "Sant Longowal Institute of Engineering and Technology": "CORE-SANT-LONGOWAL-INSTITUTE-OF-ENGINEERING-AND-TECHNOLOGY",
  "Indian Institute of Information Technology Design & Manufacturing Kurnool, Andhra Pradesh": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-DESIGN-AND-MANUFACTURING-KURNOOL",
  "Puducherry Technological University, Puducherry": "CORE-PUDUCHERRY-TECHNOLOGICAL-UNIVERSITY-PUDUCHERRY",
  "Atal Bihari Vajpayee Indian Institute of Information Technology & Management Gwalior": "CORE-ATAL-BIHARI-VAJPAYEE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-AND-MANAGEMENT-GWALIOR",
  "Indian Institute of Information Technology Bhopal": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-BHOPAL",
  "Ghani Khan Choudhary Institute of Engineering and Technology, Malda, West Bengal": "CORE-GHANI-KHAN-CHOUDHARY-INSTITUTE-OF-ENGINEERING-AND-TECHNOLOGY-MALDA-WEST-BENGAL",
  "INDIAN INSTITUTE OF INFORMATION TECHNOLOGY SENAPATI MANIPUR": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-SENAPATI-MANIPUR",
  "Pt. Dwarka Prasad Mishra Indian Institute of Information Technology, Design & Manufacture Jabalpur": "CORE-PANDHI-DWARKA-PRASAD-MISHRA-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-MANUFACTURING-JABALPUR",
  "School of Studies of Engineering and Technology, Guru Ghasidas Vishwavidyalaya, Bilaspur": "CORE-SCHOOL-OF-STUDIES-OF-ENGINEERING-AND-TECHNOLOGY-GURU-GHASIDAS-VISHWAVIDYALAYA-BILASPUR",
  "School of Engineering, Tezpur University, Napaam, Tezpur": "CORE-SCHOOL-OF-ENGINEERING-TEZPUR-UNIVERSITY-NAPAAM-TEZPUR",
  "Indian Institute of Information Technology(IIIT) Kottayam": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-KOTTAYAM",
  "Assam University, Silchar": "CORE-ASSAM-UNIVERSITY-SILCHAR",
  "Shri Mata Vaishno Devi University, Katra, Jammu & Kashmir": "CORE-SHRI-MATA-VAISHNO-DEVI-UNIVERSITY-KATRA-JAMMU-KASHMIR",
  "Gati Shakti Vishwavidyalaya, Vadodara": "CORE-GATI-SHAKTI-VISHWAVIDYALAYA-VADODARA",
  "Indian Institute of Information Technology (IIIT) Nagpur": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-NAGPUR",
  "Birla Institute of Technology, Deoghar Off-Campus": "CORE-BIRLA-INSTITUTE-OF-TECHNOLOGY-DEOGHAR",
  "National Institute of Advanced Manufacturing Technology, Ranchi": "CORE-NATIONAL-INSTITUTE-OF-ADVANCED-MANUFACTURING-TECHNOLOGY-RANCHI",
  "Indian Institute of Information Technology (IIIT)Kota, Rajasthan": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-KOTA",
  "Indian institute of information technology, Raichur, Karnataka": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-RAICHUR",
  "Indian Institute of Information Technology Tiruchirappalli": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-TIRUCHIRAPPALLI",
  "Indian Institute of Information Technology (IIIT), Sri City, Chittoor": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-SRI-CITY",
  "Indian Institute of Information Technology(IIIT) Dharwad": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-DHARWAD",
  "Indian Institute of Information Technology(IIIT) Kalyani, West Bengal": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-KALYANI",
  "Indian Institute of Information Technology, Vadodara International Campus Diu (IIITVICD)": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-VADODARA-INTERNATIONAL-CAMPUS-DIU",
  "Indian Institute of Information Technology (IIIT) Ranchi": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-RANCHI",
  "Indian Institute of Information Technology(IIIT) Una, Himachal Pradesh": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-UNA",
  "International Institute of Information Technology, Bhubaneswar": "CORE-INTERNATIONAL-INSTITUTE-OF-INFORMATION-TECHNOLOGY-BHUBANESWAR",
  "International Institute of Information Technology, Naya Raipur": "CORE-INTERNATIONAL-INSTITUTE-OF-INFORMATION-TECHNOLOGY-NAYA-RAIPUR",
  "Institute of Engineering and Technology, Dr. H. S. Gour University. Sagar (A Central University)": "CORE-INSTITUTE-OF-ENGINEERING-AND-TECHNOLOGY-DR-H-S-GOUR-UNIVERSITY-SAGAR",
  "Indian Institute of Information Technology (IIIT) Pune": "CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-PUNE",
  "Central University of Jammu": "CORE-CENTRAL-UNIVERSITY-OF-JAMMU",
  "Mizoram University, Aizawl": "CORE-MIZORAM-UNIVERSITY-AIZAWL",
  "Gurukula Kangri Vishwavidyalaya, Haridwar": "CORE-GURUKULA-KANGRI-VISHWAVIDYALAYA-HARIDWAR",
  "Institute of Infrastructure, Technology, Research and Management-Ahmedabad": "CORE-INSTITUTE-OF-INFRASTRUCTURE-TECHNOLOGY-RESEARCH-AND-MANAGEMENT-AHMEDABAD",
  "Central University of Haryana": "CORE-CENTRAL-UNIVERSITY-OF-HARYANA"
};

Object.assign(registry.engineering_map, josaaGapsMap);
registry.updatedAt = new Date().toISOString();

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log('Successfully updated Core ID Mapping with 40+ new JoSAA/GFTI rule variants.');
