import time
from playwright.sync_api import sync_playwright
rows = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True); pg = b.new_page()
    pg.goto("http://localhost:8765/#about"); time.sleep(2)
    pg.add_script_tag(path=r"C:\Users\zohai\Videos\lemonade-app-demo\work\eval_sim.js")
    fx = pg.evaluate("(()=>{const r=runEval().fixed;return [r.sens[2],r.sens[3],r.sens[5],r.fa]})()"); print("FIXED s2 s3 s5 fa", fx)
    for rb in ["false", "true"]:
        for z in [0.5, 0.8, 1.0, 1.3, 1.6, 2.0]:
            for mf in [0.7, 0.85, 1.0, 1.15]:
                for pe in [0, 2]:
                    s = f"window.SIG_ROBUST={rb};window.SIG_Z={z};window.SIG_MINF={mf};window.SIG_PERSIST={pe};"
                    r = pg.evaluate("(()=>{" + s + "const r=runEval().adaptive;return [r.sens[2],r.sens[3],r.sens[5],r.fa,r.caughtBy5]})()")
                    rows.append((rb, z, mf, pe, *r))
    b.close()
print("robust z    minf  pers s2    s3    s5    fa    by5")
for r in sorted(rows, key=lambda r: -(r[5] - r[7]))[:14]: print("%-6s %.1f  %.2f  %d    %.2f  %.2f  %.2f  %.2f  %.2f" % r)
print("--- rows with fa<=0.15, best s3")
for r in sorted([r for r in rows if r[7] <= .15], key=lambda r: -r[5])[:6]: print("%-6s %.1f  %.2f  %d    %.2f  %.2f  %.2f  %.2f  %.2f" % r)
