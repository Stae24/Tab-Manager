# Advanced Tab Search — Feature Spec
**Chromium Extension**

---

## Overview

A powerful search system for browser tabs using **bangs** (filter operators) and **commands** (action operators). Search terms can be comma-separated (CSV). The search window scope can be toggled between **current window** and **all windows**.

---

## Query Syntax

```
[text] [!bang [value]] [-!bang] [/command]
```

- **Text search** matches against title and URL by default
- **Bangs** (`!`) are filter operators — they narrow results
- **Commands** (`/`) are action operators — they act on the result set
- **Exclude modifier** (`-`) negates a bang (e.g. `-!frozen` = not frozen)
  - The `-` must be preceded by nothing or a space (not mid-word)
  - Does not affect plain text search terms
  - Does not work inside quoted strings
- **Quoted strings** (`"..."`) are treated as literal text; no bang or exclude processing occurs inside them
- **Search terms can be CSV** — multiple comma-separated values are supported

---

## Window Scope

| Option | Behavior |
|---|---|
| Current | Search only tabs in the active window |
| All | Search tabs across all open windows |

---

## Bang Reference (Filters)

### Text Field Filters

| Bang | Long form | Description |
|---|---|---|
| `!t` | `!title` | Match against tab title only |
| `!u` | `!url` | Match against tab URL only |

### Boolean / State Filters

| Bang | Description |
|---|---|
| `!frozen` / `!f` | Tab is frozen/suspended |
| `!audio` / `!a` | Tab is playing audio |
| `!pin` / `!p` | Tab is pinned |
| `!vault` / `!v` | Tab is in vault |
| `!grouped` / `!g` | Tab belongs to a group |
| `!solo` / `!s` | Tab is not in any group |
| `!duplicate` / `!d` | Tab is a duplicate (same URL exists in another tab) |
| `!local` / `!l` | Tab URL is a local resource (file://, localhost, etc.) |
| `!ip` / `!i` | Tab URL is an IP address (not a domain name) |
| `!browser` / `!b` | Tab is a browser internal page (chrome://, about:, etc.) |

### Value Filters

| Bang | Syntax | Description |
|---|---|---|
| `!ram` / `!r` | `!ram {amount}{MB\|GB} {> or <}` | Filter by memory usage. Auto-detects MB or GB suffix. Example: `!ram 500MB >` |
| `!groupname` / `!gn` | `!gn {name}` | Filter by tab group name |
| `!groupcolor` / `!gc` | `!gc {color}` | Filter by tab group color |

### Age Filters

| Bang | Syntax | Description |
|---|---|---|
| `new` | `new {age}` | Tabs opened/accessed more recently than the given age |
| `old` | `old {age}` | Tabs opened/accessed older than the given age |

**Age format:** a number followed by a unit suffix — `s` (seconds), `m` (minutes), `h` (hours), `d` (days). Example: `old 7d`, `new 30m`, `old 90s`.

---

## Command Reference (Actions)

Commands operate on the current filtered result set.

| Command | Description |
|---|---|
| `/delete` `/d` | Close/delete all tabs in the result set |
| `/save` `/s` | Save all tabs in the result set |
| `/freeze` `/f` | Freeze/suspend all tabs in the result set |

---

## Custom Bangs

Custom bangs let users define their own shorthand search combos, combining bangs and search terms for easy reuse.

**Features:**
- Combine one or more bangs with optional search terms into a named alias
- Allow full custom alias names (e.g. `!work`, `!yt`, `!heavy`)
- Configured via the extension's **Settings GUI**
- Saved to both **local and synced storage** so they persist and sync across devices
- Support **Import and Export** of custom bang definitions

**Settings GUI:**
- Accessible from the extension settings page
- Visual list of all custom bangs with add/edit/delete controls

---

## Exclude Modifier Rules

The `-` character before a bang negates it:

```
-!frozen        → tabs that are NOT frozen
-!audio         → tabs with NO audio
-!grouped       → tabs NOT in a group
```

**Parser rules for `-`:**
- Must be preceded by nothing (start of query) or a space
- Has no effect on plain text search terms (only on bangs)
- Is ignored / treated as literal inside quoted strings (`"..."`)

---

## Example Queries

```
youtube !audio                     → tabs with "youtube" in title/url that are playing audio
!ram 1GB > /freeze                 → freeze all tabs using more than 1GB of RAM
!grouped !gn work old 1d           → tabs in a group named "work" that are older than 1 day
-!frozen !pin                      → pinned tabs that are NOT frozen
"http://localhost" !local          → local tabs with that literal URL
!ram 500MB > old 2h /delete        → delete tabs using >500MB RAM open for over 2 hours
!yt                                → (custom bang) e.g. alias for: !url youtube.com !audio
```

---

## Edge Cases (TBD / Undefined)

The following behaviors are not yet specified and will need to be decided during implementation:

- **Multiple bangs on one query** — AND logic assumed but not confirmed
- **Same bang used twice** — e.g. `!gn work !gn personal` — last-wins vs. OR vs. error?
- **Bang + exclude combined on same filter** — e.g. `!frozen -!frozen` — undefined
- **Command with empty result set** — e.g. `/delete` when nothing matches — silent no-op vs. warning?

---

*Derived from handwritten design notes. Last updated: 2026-02-21.*
