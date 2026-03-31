from pathlib import Path
import re, textwrap
path = Path('phase1_foundation/run_phase1_pipeline.py')
text = path.read_text(encoding='utf-8')
old_function = re.search(r"def parse_nirf_html_file\(.*?return \{\n        \"records\": records,\n        \"provenance\": provenance,\n        \"documentDates\": document_dates,\n        \"error\": error,\n    \}\n\n", text, flags=re.S)
if not old_function:
    raise SystemExit('old block not found')
new_block = textwrap.dedent('''
    def parse_nirf_html_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
        doc_type = "NIRF 2024 overall ranking (HTML manual drop)"
        records: List[Dict[str, object]] = []
        provenance: List[Dict[str, object]] = []
        document_dates = set()
        error = ""
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            table_match = re.search(
                r'<table[^>]+id="tbl_overall"[^>]*>(.*?)</table>',
                content,
                flags=re.S | re.I,
            )
            if not table_match:
                return {
                    "records": records,
                    "provenance": provenance,
                    "documentDates": document_dates,
                    "error": "Table with id tbl_overall not found.",
                }
            tbody_match = re.search(
                r"<tbody[^>]*>(.*?)</tbody>",
                table_match.group(0),
                flags=re.S | re.I,
            )
            if not tbody_match:
                return {
                    "records": records,
                    "provenance": provenance,
                    "documentDates": document_dates,
                    "error": "No tbody section inside tbl_overall.",
                }
            rows = re.findall(
                r"<tr[^>]*>(.*?)</tr>",
                tbody_match.group(1),
                flags=re.S | re.I,
            )
            for idx, row_html in enumerate(rows, start=1):
                cells = re.findall(
                    r"<td[^>]*>(.*?)</td>",
                    row_html,
                    flags=re.S | re.I,
                )
                if not cells:
                    continue
                values = [strip_html_tags(cell) for cell in cells]
                if len(values) < 6:
                    continue
                row_data = {
                    "institution": values[1],
                    "city": values[2],
                    "state": values[3],
                    "score": values[4],
                    "rank": values[5],
                }
                result = build_ranking_record(
                    row_data,
                    run_timestamp,
                    file_path,
                    doc_type,
                    "",
                    idx,
                )
                if result:
                    record, prov = result
                    records.append(record)
                    provenance.append(prov)
        except Exception as exc:
            error = str(exc)
        return {
            "records": records,
            "provenance": provenance,
            "documentDates": document_dates,
            "error": error,
        }

''')
start, end = old_function.span()
text = text[:start] + new_block + text[end:]
path.write_text(text, encoding='utf-8')
