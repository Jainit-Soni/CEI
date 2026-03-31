from pathlib import Path
import re, textwrap
path = Path('phase1_foundation/run_phase1_pipeline.py')
text = path.read_text(encoding='utf-8')
old_function = re.search(r"def parse_nirf_html_file\(.*?return \{\n        \"records\": records,\n        \"provenance\": provenance,\n        \"documentDates\": document_dates,\n        \"error\": error,\n    \}\n\n", text, flags=re.S)
if not old_function:
    raise SystemExit('old html function not found')
new_block = textwrap.dedent('''
    def parse_nirf_html_file(file_path: Path, run_timestamp: str) -> Dict[str, object]:
        doc_type = "NIRF 2024 overall ranking (HTML manual drop)"
        records: List[Dict[str, object]] = []
        provenance: List[Dict[str, object]] = []
        document_dates = set()
        error = ""

        class OverallTableParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.table_depth = 0
                self.in_target_table = False
                self.in_tbody = False
                self.in_td = False
                self.current_data: List[str] = []
                self.current_row: List[str] = []
                self.rows: List[List[str]] = []

            def handle_starttag(self, tag, attrs):
                if tag == "table":
                    attr_dict = {k: v for k, v in attrs}
                    if not self.in_target_table and attr_dict.get("id") == "tbl_overall":
                        self.in_target_table = True
                        self.table_depth = 1
                    elif self.in_target_table:
                        self.table_depth += 1
                if self.in_target_table and self.table_depth == 1 and tag == "tbody":
                    self.in_tbody = True
                if self.in_tbody and self.table_depth == 1 and tag == "td":
                    self.in_td = True
                    self.current_data = []

            def handle_endtag(self, tag):
                if tag == "td" and self.in_td:
                    text = "".join(self.current_data).strip()
                    self.current_row.append(strip_html_tags(text))
                    self.in_td = False
                if tag == "tr" and self.in_tbody and self.table_depth == 1:
                    if self.current_row:
                        self.rows.append(self.current_row)
                        self.current_row = []
                if tag == "tbody" and self.in_tbody:
                    self.in_tbody = False
                if tag == "table" and self.in_target_table:
                    self.table_depth -= 1
                    if self.table_depth == 0:
                        self.in_target_table = False

            def handle_data(self, data):
                if self.in_td and self.table_depth == 1:
                    self.current_data.append(data)

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            parser = OverallTableParser()
            parser.feed(content)
            parser.close()
            rows = parser.rows
            if not rows:
                return {
                    "records": records,
                    "provenance": provenance,
                    "documentDates": document_dates,
                    "error": "No rows parsed from the overall ranking table.",
                }
            for idx, values in enumerate(rows, start=1):
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
new_text = text[:start] + new_block + text[end:]
path.write_text(new_text, encoding='utf-8')
