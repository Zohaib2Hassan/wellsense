import json, time
from playwright.sync_api import sync_playwright
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8765/#about"); time.sleep(2)
    pg.add_script_tag(path=r"C:\Users\zohai\Videos\lemonade-app-demo\work\eval_sim.js")
    t = time.time(); r = pg.evaluate("runEval()"); print("eval took %.1fs" % (time.time() - t))
    b.close()
print(json.dumps(r, ensure_ascii=False, indent=1))
open(r"C:\Users\zohai\Videos\lemonade-app-demo\work\eval_results.json", "w", encoding="utf-8").write(json.dumps(r, ensure_ascii=False, indent=1))
print("ERRORS:", errs)
