from pathlib import Path
path = Path('phase1_foundation/run_phase1_pipeline.py')
text = path.read_text(encoding='utf-8')
pattern = r"def parse_nirf_html_file\(.+?def parse_nirf_pdf_file"  # we will keep the trailing function header
import re
match = re.search(pattern, text, flags=re.S)
if not match:
    raise SystemExit('pattern not found for html function')
start = match.start()
end = match.end()
new_block = """def parse_nirf_html_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:\n    doc_type = \"NIRF 2024 overall ranking (HTML manual drop)\"\n    records: List[Dict[str, object]] = []\n    provenance: List[Dict[str, object]] = []\n    document_dates = set()\n    error = \"\"\n    try:\n        content = file_path.read_text(encoding=\"utf-8\", errors=\"ignore\")\n        table_match = re.search(\n            r'<table[^>]+id=\"tbl_overall\"[^>]*>(.*?)</table>',\n            content,\n            flags=re.S | re.I,\n        )\n        if not table_match:\n            return {\n                \"records\": records,\n                \"provenance\": provenance,\n                \"documentDates\": document_dates,\n                \"error\": \"Table with id tbl_overall not found.\",\n            }\n        table_html = table_match.group(0)\n        cleaned_table = re.sub(\n            r'<div[^>]*class=\"tbl_hidden\"[^>]*>.*?</div>',\n            \"\",\n            table_html,\n            flags=re.S | re.I,\n        )\n        tbody_match = re.search(\n            r"<tbody[^>]*>(.*?)</tbody>",\n            cleaned_table,\n            flags=re.S | re.I,\n        )\n        if not tbody_match:\n            return {\n                \"records\": records,\n                \"provenance\": provenance,\n                \"documentDates\": document_dates,\n                \"error\": \"No tbody section inside tbl_overall.\",\n            }\n        rows = re.findall(\n            r"<tr[^>]*>(.*?)</tr>",\n            tbody_match.group(1),\n            flags=re.S | re.I,\n        )\n        for idx, row_html in enumerate(rows, start=1):\n            cells = re.findall(\n                r"<td[^>]*>(.*?)</td>",\n                row_html,\n                flags=re.S | re.I,\n            )\n            if len(cells) < 6:\n                continue\n            values = [strip_html_tags(cell) for cell in cells]\n            row_data = {\n                \"institution\": values[1],\n                \"city\": values[2],\n                \"state\": values[3],\n                \"score\": values[4],\n                \"rank\": values[5],\n            }\n            result = build_ranking_record(\n                row_data,\n                run_timestamp,\n                file_path,\n                doc_type,\n                \"\",\n                idx,\n            )\n            if result:\n                record, prov = result\n                records.append(record)\n                provenance.append(prov)\n    except Exception as exc:\n        error = str(exc)\n    return {\n        \"records\": records,\n        \"provenance\": provenance,\n        \"documentDates\": document_dates,\n        \"error\": error,\n    }\n\n"""
# we need to append the next function header (def parse_nirf_pdf_file...)
next_func = 'def parse_nirf_pdf_file'
next_index = text.find(next_func, match.end())
if next_index == -1:
    raise SystemExit('next function header not found')
new_text = text[:start] + new_block + text[next_index:]
path.write_text(new_text, encoding='utf-8')
