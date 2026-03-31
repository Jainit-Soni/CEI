from html.parser import HTMLParser
from pathlib import Path
import re
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
            self.current_row.append(text)
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
parser=TestParser()
path=Path('phase1_foundation/manual_inputs/nirf/MoE, National Institute Ranking Framework (NIRF).html')
content=path.read_text(encoding='utf-8', errors='ignore')
parser.feed(content)
parser.close()
print('rows', len(parser.rows))
for idx,row in enumerate(parser.rows[:3],1):
    print(idx,len(row), row[:6])
