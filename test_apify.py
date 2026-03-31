from apify_client import ApifyClient
from pathlib import Path
import os
import json

token = os.getenv("APIFY_TOKEN")
if not token:
    raise SystemExit("APIFY_TOKEN is missing. Set it in CMD first.")

client = ApifyClient(token)

run_input = {
    "startUrls": [
        {"url": "https://www.nta.ac.in/NoticeBoardArchive"}
    ],
    "maxCrawlPages": 30,
    "maxCrawlDepth": 1,
}

print("Starting Apify actor run...")

run = client.actor("apify/website-content-crawler").call(run_input=run_input)

dataset_id = run["defaultDatasetId"]
dataset = client.dataset(dataset_id)

# Pull all items, not just the first page
items = list(dataset.iterate_items())

out_dir = Path("cei_raw") / "nta_noticeboard"
out_dir.mkdir(parents=True, exist_ok=True)

out_file = out_dir / "items.json"
with open(out_file, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print(f"Run finished.")
print(f"Dataset ID: {dataset_id}")
print(f"Saved {len(items)} items to: {out_file.resolve()}")