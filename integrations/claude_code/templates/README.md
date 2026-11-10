# Claude Code integration templates

Drop-in files to monitor another repo's Claude Code sessions with DriftGuard.
Copy both into that repo's `.claude/` folder and fill in the two values.

## Steps

1. Make sure the DriftGuard server is running (`startup.bat` in the DriftGuard
   repo) at `http://127.0.0.1:8000`.
2. In the dashboard, create a project for the other repo and copy its API key.
3. Copy both files into the other repo at:
   - `.claude/driftguard.json`
   - `.claude/settings.local.json`
4. In `driftguard.json`, replace:
   - `REPLACE_WITH_PROJECT_ID` with the project's id
   - `REPLACE_WITH_DG_LIVE_KEY` with its `dg_live_...` API key
5. In `settings.local.json`, replace every `REPLACE_WITH_DRIFTGUARD_REPO_PATH`
   with the absolute path of your DriftGuard checkout, with forward slashes
   (for example `C:/code/DriftGuard`).
6. Start a new Claude Code session in that repo (or run `/hooks` once).

## Notes

- `settings.local.json` points at this repo's hook script by **absolute path**,
  so the other repo needs nothing installed beyond Python 3.10+ on PATH as
  `python`. If you move or rename the DriftGuard repo, update that path (or copy
  `driftguard_hook.py` into the other repo and use `$CLAUDE_PROJECT_DIR`).
- `.claude/driftguard.json` holds the API key — keep it out of version control.
- `capture_content` sends prompt and tool text; the server stores it only if the
  project has content storage enabled in Project Settings.
- Raise the project's policy token limits for Claude Code work (the chat defaults
  are low): ~30,000 new tokens per call, ~400,000 context.
