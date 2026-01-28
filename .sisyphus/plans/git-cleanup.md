# Plan: Git Cleanup & Tracking Fix

## Context

### Original Request
The user is seeing files in GitHub Desktop that should be ignored (node_modules, dist, diagnostic zips, screenshots).

### Interview Summary
- The user's `.gitignore` already contains `/node_modules` and `/dist`, but Git is still tracking them.
- This happens because the files were added to the index before the ignore rules were set.
- A comprehensive cleanup of the index and the `.gitignore` file is required.

### Metis Review
- **Risks**: Over 9,000 files in `node_modules` are being tracked. Removing them from the cache will create a large commit.
- **Improvements**: Recommended adding security ignores (`.env`, `*.pem`) and common Vite/Extension artifacts.
- **Cleanup**: Identified dead rules like `/%TMP%/dnd-kit` and `nul` in the current `.gitignore`.

---

## Work Objectives

### Core Objective
Untrack all ignored files so they no longer appear in GitHub Desktop's "Changes" list, and harden the `.gitignore` for future development.

### Concrete Deliverables
- Updated `.gitignore` file.
- Cleaned Git index (files removed from tracking).
- Final commit reflecting the cleanup.

### Must Have
- Comprehensive ignore patterns for: node_modules, build outputs, environment variables, screenshots, and IDE files.
- Quiet removal of tracked `node_modules` to prevent terminal overflow.
- Verification that no files were physically deleted from the disk.

### Must NOT Have
- Do NOT use `git rm` without the `--cached` flag (must preserve local files).
- Do NOT leave `node_modules` in the index.

---

## Verification Strategy

### QA Approach
- Manual verification of the Git index state using `git ls-files`.
- Visual verification in GitHub Desktop (per user request).

---

## TODOs

- [x] 1. Update .gitignore with comprehensive patterns
  **What to do**:
  - Replace current `.gitignore` content with:
    ```gitignore
    # Dependencies
    /node_modules

    # Build outputs
    /dist
    *.tsbuildinfo

    # Environment & Secrets
    .env
    .env.local
    .env.*.local
    *.pem

    # Chrome Extension artifacts
    *.crx
    *.zip
    key.pem

    # IDE & OS
    /.vscode
    /.idea
    .DS_Store
    Thumbs.db

    # Logs & Debug
    *.log
    npm-debug.log*

    # Test & Coverage
    /coverage

    # Vite cache
    .vite/

    # Screenshots
    /Screenshot*.png

    # Legacy Reference (Project Specific)
    /TidyTabGroups
    ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Acceptance Criteria**:
  - [ ] `.gitignore` contains all recommended patterns.
  - [ ] Dead rules (`/%TMP%`, `nul`) are removed.

- [x] 2. Remove ignored files from Git index
  **What to do**:
  - Run `git rm -r --cached --quiet node_modules dist git-diagnostics-*.zip Screenshot*.png`
  - Note: This only removes them from tracking; it does NOT delete them from your folders.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: ["git-master"]

  **Acceptance Criteria**:
  - [ ] Command completes successfully.
  - [ ] `git status` shows thousands of "deleted" files in the staged area.

- [ ] 3. Verification & Commit
  **What to do**:
  - Verify node_modules is untracked: `git ls-files --cached node_modules | wc -l` (should be 0).
  - Add the updated `.gitignore`: `git add .gitignore`
  - Commit: `git commit -m "chore: untrack node_modules and dist, update .gitignore"`

  **Acceptance Criteria**:
  - [ ] Final commit is created.
  - [ ] `git status` no longer shows ignored files as changed or untracked.

---

## Success Criteria
- [ ] GitHub Desktop "Changes" list only shows relevant source code.
- [ ] `node_modules` and `dist` are no longer tracked.
- [ ] `.gitignore` is robust and follows best practices.
