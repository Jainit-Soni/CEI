import subprocess
import sys
from pathlib import Path

COLLECTORS = {
    "nta_noticeboard": "collectors/collect_nta_notice_archive.py",
    "josaa_notices": "collectors/collect_josaa_notices.py",
    "nta_exam_pages": "collectors/collect_nta_exam_pages.py",
    "college_pages": "collectors/collect_college_pages.py",
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_collector.py <source_id>")
        print("Available:", ", ".join(COLLECTORS.keys()))
        return

    source_id = sys.argv[1]
    script = COLLECTORS.get(source_id)

    if not script:
        print(f"Unknown source_id: {source_id}")
        return

    path = Path(script)
    if not path.exists():
        print(f"Missing collector: {path}")
        return

    subprocess.run([sys.executable, str(path)], check=True)

if __name__ == "__main__":
    main()
