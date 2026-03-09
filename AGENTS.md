# AGENTS.md

Guidance for contributors/agents working on **GitHub PR Toolkit**.

## Main rules

- Keep behavior stable unless explicitly changing product behavior.
- Prefer structural/id-based selectors over user-visible text selectors.
- When targeting GitHub UI, expect dynamic DOM updates and duplicate nodes.
- Keep extension logic modular; avoid moving back to a single large content script.
- Do not add external dependencies unless clearly necessary.
- Keep code ASCII-only unless a file already requires Unicode.

## Testing rule (required)

After every substantive change (only if `chrome-devtools-mcp` is available and connected):

1. Reload extension in `chrome://extensions`
2. Refresh PR page in `.../pull/<id>/changes`
3. Verify at minimum:
   - filter UI mount position in left sidebar
   - owner filtering updates right-side files correctly
   - tree leaf/folder visibility remains in sync
   - owner badges are rendered in diff headers
   - badge hover popup appears and has visible background

## Browser tooling rule

- Use Chrome DevTools MCP connected to the existing local Chrome instance for all manual checks.
- Do not use the embedded browser for extension testing in this repository.
- Prefer working with the currently open PR page/session to keep extension state and auth context intact.

## File structure

- `manifest.json`
  - content script load order (must remain deterministic)
- `src/content/shared.js`
  - shared constants/state + generic helpers
- `src/content/owners.js`
  - owner extraction + badge + hovercard features
- `src/content/filtering.js`
  - filtering logic for diff panel and tree
- `src/content/ui.js`
  - filter panel creation/mount + owner checkbox UI
- `src/content/main.js`
  - runtime orchestration loop
- `src/styles.css`
  - styling for filter panel, badges, hovercard

## Implementation preferences

- Reuse helper functions from `shared.js`; avoid duplicate utility functions.
- Keep `main.js` orchestration-focused (minimal logic).
- Put owner/badge logic in `owners.js`, filter logic in `filtering.js`, UI in `ui.js`.
- If selector changes are needed, add comments briefly explaining why the selector is robust.
