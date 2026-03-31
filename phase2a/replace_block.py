from pathlib import Path
path = Path('phase2a/aicte_live_collect.py')
text = path.read_text()
start = text.index('        page = await context.new_page()')
end = text.index('        session = context.request', start)
new_block = '''        page = await context.new_page()
        url =  https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php
        for attempt in range(2):
            try:
                await page.goto(url, wait_until=domcontentloaded, timeout=60000)
                await page.wait_for_selector(body, timeout=15000)
                break
            except PlaywrightError as exc:
                logging.warning(Dashboard load attempt %s failed: %s, attempt + 1, exc)
                if attempt == 1:
                    raise
                await asyncio.sleep(2)
'''
path.write_text(text[:start] + new_block + text[end:])
