# WellSense — sense early, act sooner

**Future Health Digital Innovation Challenge 2026 · Wellbeing track · Healthy habits / lifestyle**
Team Afghan · Zohaib Hassan (solo entry)

WellSense is a private wellbeing companion that learns each person's normal, spots early drifts in sleep, mood, stress and activity, and helps them act with small habits, a local AI coach and instant emergency help. It runs entirely on the user's own computer: no account, no cloud, and no health data leaves the device.

- **Live demo:** https://wellsense-demo.netlify.app/ (sample data, recorded coach answers, no login)
- **Demo video (2 min):** https://1drv.ms/v/c/b06b716fdfed382a/IQCBemhS4SjZRZ0j7dusgdgwAfKaEIMQbdywkg7g7pRCqy0?e=dx2y2S

## What it does

| Step | What happens |
| --- | --- |
| **Sense** | One-minute daily check-in: mood, energy, stress, sleep, water, steps; optional blood pressure, symptoms and a note; weekly PHQ-2 / GAD-2 |
| **Predict** | Last 3 days vs the person's own previous 14 days. A signal appears only when the change is big enough to matter **and** beyond their usual swings. Combined rules for several measures worsening together, persistent low mood and high blood pressure |
| **Support** | One small action per signal, a habit tracker (up to 4 habits, sleep/water/steps tick themselves), and a local AI coach that explains signals and builds a 7-day habit plan |
| **Safety** | English and Arabic red-flag words show UAE / Pakistan emergency numbers and 12 first-aid guides before any AI answer, even offline |

Full Arabic with right-to-left layout, light and dark themes, and a Pakistan / UAE region switch.

## Evaluation (simulated)

400 synthetic users (200 with a gradual change, 200 stable, 10% missed check-ins), same data through WellSense and a fixed-threshold rule:

| Measure | WellSense | Fixed thresholds |
| --- | --- | --- |
| Changes caught within 3 days | 84% | 89% |
| False alarms on stable users | 16% | 22% |
| Median days to first signal | 2 | 2 |

Safety check: 32 / 32 emergency phrases caught (English and Arabic), 0 of 20 everyday phrases flagged. Synthetic data only, not a clinical study. Reproduce with `eval/run_eval.py` (needs Playwright and the app served locally).

## Run it

1. Optional, for the AI coach: install [Lemonade Server](https://github.com/lemonade-sdk/lemonade) and pull `Qwen3-4B-Instruct-2507-GGUF` (WellSense loads it on the CPU backend).
2. In this folder: `python -m http.server 8765 --bind 127.0.0.1` (or double-click `start.cmd` on Windows).
3. Open http://localhost:8765 and press **Load demo data** on the About page.

Without Lemonade, everything except the live coach works. `web/index.html` is the single-file online demo.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `wellsense.js`, `wellsense.css` | The app |
| `i18n.js` | Arabic text, 12 first-aid guides (EN/AR), Arabic red-flag words |
| `eval_results.js` | Evaluation results shown on the About page |
| `demo.js` | Recorded coach answers for the online demo |
| `web/index.html` | Single-file hosted demo |
| `eval/` | Simulation, parameter search and runner |

## Limitations

Tested on synthetic users only; Arabic PHQ-2 / GAD-2 wording is a translation, not the validated version; coach answers take 30–80 s on older CPUs; data lives in one browser on one device. WellSense gives general wellbeing information, not medical advice.

## Credits and licenses

Lemonade Server (Apache 2.0), llama.cpp (MIT), Qwen3-4B-Instruct-2507 (Apache 2.0), Google Fonts (SIL OFL). WellSense code © 2026 Zohaib Hassan, all rights reserved. Independent entry, not affiliated with or endorsed by Future Health or its partners.
