from html.parser import HTMLParser
from pathlib import Path
class TestParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.table_depth = 0
        self.in_target_table = False
        self.in_tbody = False
        self.in_td = False
        self.current_data = []
        self.current_row = []
        self.rows = []
        self.events = []
    def handle_starttag(self, tag, attrs):
        self.events.append(('start', tag, self.table_depth, dict(attrs)))
        if tag == "table":
            attr_dict = {k: v for k, v in attrs}
            if not self.in_target_table and attr_dict.get("id") == "tbl_overall":
                self.in_target_table = True
                self.table_depth = 1
                self.events.append(('target_table_start', self.table_depth))
            elif self.in_target_table:
                self.table_depth += 1
                self.events.append(('nested_table', self.table_depth))
        if self.in_target_table and self.table_depth == 1 and tag == "tbody":
            self.in_tbody = True
            self.events.append(('tbody_start', self.table_depth))
        if self.in_tbody and self.table_depth == 1 and tag == "td":
            self.in_td = True
            self.current_data = []
            self.events.append(('td_start', self.table_depth))
    def handle_endtag(self, tag):
        if tag == "td" and self.in_td:
            text = "".join(self.current_data).strip()
            self.current_row.append(text)
            self.in_td = False
            self.events.append(('td_end', text))
        if tag == "tr" and self.in_tbody and self.table_depth == 1:
            if self.current_row:
                self.rows.append(self.current_row)
                self.events.append(('row_added', len(self.current_row)))
                self.current_row = []
            else:
                self.events.append(('row_skipped', len(self.current_row)))
        if tag == "tbody" and self.in_tbody:
            self.in_tbody = False
        if tag == "table" and self.in_target_table:
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_target_table = False
                self.events.append(('target_table_end', self.table_depth))
    def handle_data(self, data):
        if self.in_td and self.table_depth == 1:
            self.current_data.append(data)
path=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html')
parser=TestParser()
parser.feed(path.read_text(encoding='utf-8', errors='ignore'))
parser.close()
print('rows', len(parser.rows))
for event in parser.events[:30]:
    print(event)
