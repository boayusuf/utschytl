# Utschytl

*Explain it back. Find out what you actually understand.*

A study tool for TeachAthon 2026 (University of Edinburgh). A lecturer turns a week's slides into 8–14 learning outcomes with a short rubric each. Students explain each outcome in their own words to a tutor that only asks questions and never gives the answer. The lecturer sees which outcomes the class still can't explain, in students' own (anonymised) words, and how confident students felt before they tried.

Built with Flask + plain HTML/JS, Google Gemini, and Supabase. No build step.

## Run locally (2 minutes)

```bash
pip install -r requirements.txt
python -m server.seed --reset     # demo course with 9 simulated students
python run_local.py               # http://127.0.0.1:5000
```

Without a `GEMINI_API_KEY` the app runs on an offline mock tutor, which is enough to click through every screen. Lecturer area PIN: `1234`.

With a key:

```bash
export GEMINI_API_KEY=...         # aistudio.google.com, free tier
python run_local.py
```

## Deploy to Vercel (5 minutes)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: *Other*. No build command.
3. Add environment variables (Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key |
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_KEY` | the project's publishable / anon key |
   | `LECTURER_PIN` | a PIN for the lecturer area |
   | `SECRET_KEY` | any long random string |
   | `APP_NAME` | optional, renames the product everywhere |

4. In Supabase: **SQL Editor → New query**, paste `sql/schema.sql`, run.
5. Deploy. Then seed the demo data against Supabase from your laptop:

   ```bash
   SUPABASE_URL=... SUPABASE_KEY=... python -m server.seed
   ```

If `SUPABASE_URL` is not set the app still works on Vercel but keeps data in a per-instance JSON file in `/tmp`, which resets on cold starts. Fine for a quick demo, not for a class.

## How it works

```
Lecturer                         Student                          Lecturer
slides.pdf ──► AI drafts ──► edit/publish ──► rate confidence 1–5 ──► explain in own words
                 outcomes+rubric                                    │
                                                 ┌──────────────────┴──────────────────┐
                                                 │ judge ×2 (JSON, must agree; evidence │
                                                 │   verified against student text)     │
                                                 │   criterion, misconceptions          │
                                                 │ tutor (one question, no answers,     │
                                                 │   give-away words forbidden, gate)   │
                                                 └──────────────────┬──────────────────┘
                                                 all met → card flips          ──► gap report:
                                                 2 tries → hint allowed             % not yet per outcome,
                                                 12 turns → parked                  per-criterion, quotes (n≥5),
                                                                                    felt vs shown, re-teach draft
```

Prompts: `server/prompts.py`. Orchestration: `server/logic.py`. Storage: `server/store.py` (JSON file or Supabase/PostgREST, same interface). Gemini: `server/llm.py` (REST, no SDK).

## Tests

```bash
python run_local.py &          # mock mode
python -I tests/e2e.py         # Playwright walkthrough of all screens, screenshots in tests/screens/
```

## Before any real classroom use

- Replace the demo RLS policies in `sql/schema.sql` with per-course lecturer auth (Supabase Auth + a `lecturers` table); replace the PIN with SSO.
- Point `GEMINI_*` at an institutionally contracted or self-hosted model so student text never leaves university control.
- Keep `MIN_STUDENTS_FOR_QUOTES` ≥ 5 and keep the report aggregate-only.
