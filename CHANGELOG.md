# oh-my-claudecode v4.16.0: HUD Visual Consistency & Density Budget

## Breaking Changes

Seven HUD display changes. All are visual-only; no data semantics changed. Users can restore prior behavior via explicit `omcHud.elements` overrides.

1. **focused preset: `showCallCounts` / `promptTime` default `true` → `false`** — call counts and prompt time moved to the `detail` layout group (rendered as separate lines below the main statusline when enabled). Restore: `"elements": { "showCallCounts": true, "promptTime": true }` and add `callCounts`/`promptTime` to `layout.main`.
2. **opencode preset: `agentsFormat` `'codes'` → `'tasks'`** — single-character agent codes (30+ entry memorization) replaced by human-readable task descriptions. Restore: `"elements": { "agentsFormat": "codes" }`.
3. **context/background/ralph/session labels: plain → dim** — labels now use `dim(label:)` + colored value, unifying the `R-LABEL-1` rule. No restore needed (visual only).
4. **ctx action word: `COMPRESS?` → `! compact`** — imperative phrasing, consistent with the detail-line `run /compact`. No restore needed.
5. **error badges: `[API 429]` / `[API auth]` / `[API err]` → `[usage:429]` / `[usage:auth]` / `[usage:err]`** — clarifies the error source is the usage API, not a generic program error. No restore needed.
6. **multi-repo tutorial: inline shell command → `⚠ multi-repo (unmarked)`** — the statusline no longer embeds `echo {} > ...` tutorials; guidance moved to docs. No restore needed.
7. **region separator: `|` → `╎` (U+257E) for I/O/S region boundaries** — ioGrouping region boundaries now use a visually distinct separator from the element separator `|`. safeMode falls back to `|`. Restore: disable `ioGrouping`.

## Other Improvements

- **emoji/ambiguous width: 1 → 2 columns** (B-1, P1-13) — `getCharWidth` now returns 2 for emoji (🔧🤖⚡💭⏱) and ambiguous-width chars (⇡⇣↑↓), fixing truncation off-by-width.
- **safeMode ASCII replacement table** (B-2) — emoji/ambiguous/region-separator chars are replaced with fixed-width ASCII in safeMode for deterministic column alignment.
- **narrow terminal detail preservation** (B-6, P1-14) — below 70 columns, detail lines (warnings/agents/todos) are prioritized over the main line so actionable context is never lost.

---

# oh-my-claudecode v4.15.7: Bug Fixes

## Release Notes

Release with **4 bug fixes**, **1 other change** across **5 merged PRs**.

### Highlights

- **fix(psm): fail closed on malformed worktree results** (#3531)
- **fix(psm): use jira-cli --raw instead of non-existent --output json** (#3529)
- **fix(psm): use tmux-safe session names so sessions stay manageable** (#3530)

### Bug Fixes

- **fix(psm): fail closed on malformed worktree results** (#3531)
- **fix(psm): use jira-cli --raw instead of non-existent --output json** (#3529)
- **fix(psm): use tmux-safe session names so sessions stay manageable** (#3530)
- **fix(windows): separate prompt host and worker timeouts** (#3525)

### Other Changes

- **ci: add main generated-artifact authorization trust root** (#3540)

### Stats

- **5 PRs merged** | **0 new features** | **4 bug fixes** | **0 security/hardening improvements** | **1 other change**
