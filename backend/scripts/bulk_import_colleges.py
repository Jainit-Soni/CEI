#!/usr/bin/env python3
"""
Bulk College Import Script
===========================
This script helps you add multiple colleges to the database efficiently.

Usage:
1. Prepare your college data in CSV/Excel format
2. Run: python bulk_import_colleges.py --input colleges.csv --state Gujarat
3. The script will validate and add colleges to the respective state JSON file

Required CSV columns:
- name: Full college name
- shortName: Short/display name
- location: City, District, State
- rankingTier: Tier 1/2/3
- overview: Brief description
- acceptedExams: Comma-separated list (jee-main,gujcet,neet-ug)
- courses: JSON array of course objects
- district: District name
- ownership: Government/Private/Grant-in-Aid
"""

import json
import csv
import sys
import argparse
import os
from pathlib import Path
import re

def generate_id(name):
    """Generate a unique ID from college name"""
    # Remove special characters, convert to lowercase, replace spaces with hyphens
    id_str = re.sub(r'[^\w\s-]', '', name.lower())
    id_str = re.sub(r'[-\s]+', '-', id_str)
    return id_str[:50]  # Limit length

def validate_college(college):
    """Validate college data structure"""
    required_fields = ['name', 'location', 'rankingTier']
    for field in required_fields:
        if field not in college or not college[field]:
            return False, f"Missing required field: {field}"
    
    # Validate ranking tier
    if college['rankingTier'] not in ['Tier 1', 'Tier 2', 'Tier 3']:
        return False, "rankingTier must be Tier 1, Tier 2, or Tier 3"
    
    return True, "Valid"

def load_existing_colleges(state_file):
    """Load existing colleges from state JSON file"""
    try:
        with open(state_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        print(f"Error: {state_file} contains invalid JSON")
        return []

def save_colleges(state_file, colleges):
    """Save colleges to state JSON file"""
    with open(state_file, 'w', encoding='utf-8') as f:
        json.dump(colleges, f, indent=2, ensure_ascii=False)

def parse_courses(courses_str):
    """Parse courses from string format"""
    if not courses_str:
        return []
    
    courses = []
    # Try to parse as JSON first
    try:
        return json.loads(courses_str)
    except:
        pass
    
    # Simple parsing: course_name|degree|duration|exams
    for course_line in courses_str.split(';'):
        parts = course_line.strip().split('|')
        if len(parts) >= 2:
            courses.append({
                "name": parts[0].strip(),
                "degree": parts[1].strip() if len(parts) > 1 else "B.Tech",
                "duration": parts[2].strip() if len(parts) > 2 else "4 years",
                "exams": [e.strip() for e in parts[3].split(',')] if len(parts) > 3 else ["merit-based"]
            })
    return courses

def import_from_csv(csv_file, state_name):
    """Import colleges from CSV file"""
    state_filename = f"{state_name.replace(' ', '_')}_Colleges.json"
    state_path = Path(__file__).parent / "models" / state_filename
    
    # Load existing colleges
    existing_colleges = load_existing_colleges(state_path)
    existing_ids = {c['id'] for c in existing_colleges}
    
    new_colleges = []
    updated_count = 0
    skipped_count = 0
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Generate ID
            college_id = generate_id(row['name'])
            
            # Skip if already exists
            if college_id in existing_ids:
                skipped_count += 1
                continue
            
            # Build college object
            college = {
                "id": college_id,
                "name": row['name'],
                "shortName": row.get('shortName', row['name']),
                "location": row['location'],
                "rankingTier": row['rankingTier'],
                "overview": row.get('overview', ''),
                "campus": row.get('campus', ''),
                "officialUrl": row.get('officialUrl', ''),
                "acceptedExams": [e.strip() for e in row.get('acceptedExams', '').split(',') if e.strip()],
                "courses": parse_courses(row.get('courses', '')),
                "pastCutoffs": [],
                "topRecruiters": [r.strip() for r in row.get('topRecruiters', '').split(',') if r.strip()],
                "tuition": row.get('tuition', ''),
                "sources": [row.get('officialUrl', '')] if row.get('officialUrl') else [],
                "meta": {
                    "affiliations": [a.strip() for a in row.get('affiliations', '').split(',') if a.strip()],
                    "ownership": row.get('ownership', 'Private'),
                    "establishedYear": row.get('establishedYear', ''),
                    "district": row.get('district', '')
                }
            }
            
            # Validate
            is_valid, message = validate_college(college)
            if not is_valid:
                print(f"Skipping invalid college '{row['name']}': {message}")
                skipped_count += 1
                continue
            
            new_colleges.append(college)
            existing_ids.add(college_id)
            updated_count += 1
    
    # Merge and save
    all_colleges = existing_colleges + new_colleges
    save_colleges(state_path, all_colleges)
    
    print(f"\nImport Summary for {state_name}:")
    print(f"  - New colleges added: {updated_count}")
    print(f"  - Skipped (duplicates/invalid): {skipped_count}")
    print(f"  - Total colleges in {state_name}: {len(all_colleges)}")
    print(f"  - File saved: {state_path}")
    
    return updated_count

def create_template_csv(output_file):
    """Create a template CSV file for bulk import"""
    template_data = [
        {
            'name': 'Example Engineering College',
            'shortName': 'EEC',
            'location': 'Ahmedabad, Ahmedabad District, Gujarat',
            'rankingTier': 'Tier 2',
            'overview': 'A leading engineering college offering quality technical education.',
            'campus': 'Sector 15, Ahmedabad',
            'officialUrl': 'https://www.example.edu',
            'acceptedExams': 'jee-main,gujcet',
            'courses': 'B.Tech Computer Science|B.Tech|4 years|jee-main;B.Tech Mechanical|B.Tech|4 years|jee-main',
            'district': 'Ahmedabad',
            'ownership': 'Private',
            'establishedYear': '1995',
            'affiliations': 'GTU,AICTE',
            'topRecruiters': 'TCS,Infosys,Wipro',
            'tuition': 'INR 1.5 Lakhs/year'
        }
    ]
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=template_data[0].keys())
        writer.writeheader()
        writer.writerows(template_data)
    
    print(f"Template CSV created: {output_file}")
    print("Fill in your college data following this format and run:")
    print(f"  python bulk_import_colleges.py --input {output_file} --state 'State Name'")

def main():
    parser = argparse.ArgumentParser(description='Bulk Import Colleges to Database')
    parser.add_argument('--input', '-i', help='Input CSV file with college data')
    parser.add_argument('--state', '-s', help='State name (e.g., Gujarat, Maharashtra)')
    parser.add_argument('--template', '-t', help='Create template CSV file', action='store_true')
    parser.add_argument('--output', '-o', default='colleges_template.csv', help='Output template filename')
    
    args = parser.parse_args()
    
    if args.template:
        create_template_csv(args.output)
        return
    
    if not args.input or not args.state:
        print("Error: Both --input and --state are required (or use --template to create a template)")
        print("\nExamples:")
        print("  Create template:  python bulk_import_colleges.py --template")
        print("  Import colleges:  python bulk_import_colleges.py --input colleges.csv --state Gujarat")
        sys.exit(1)
    
    if not os.path.exists(args.input):
        print(f"Error: File not found: {args.input}")
        sys.exit(1)
    
    count = import_from_csv(args.input, args.state)
    
    if count > 0:
        print(f"\n✅ Successfully imported {count} colleges to {args.state}!")
        print("\nNext steps:")
        print("1. Restart the backend server to load new data")
        print("2. Verify the colleges appear in the frontend")
        print("3. Run: cd backend && node check_loading.js")

if __name__ == '__main__':
    main()
