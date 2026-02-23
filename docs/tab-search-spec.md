# Advanced Tab Search — Feature Spec
**Chromium Extension**

---

## Overview

A powerful search system for browser tabs using **bangs** (filter operators) and **commands** (action operators). Search terms can be comma-separated (CSV). The search window scope can be toggled between **current window** and **all windows**.

---

## Query Syntax

```
[term, term, ...] [!bang [value]] [-!bang] [/command]
```

- **Bangs** (`!`) are filter operators — they narrow results
- **Commands** (`/`) are action operators — they act on the result set
- **Exclude modifier** (`-`) negates a bang (e.g. `-!frozen` = not frozen)
  - Must be preceded by nothing (start of query) or a space
  - Does not affect plain text search terms
  - Does not work inside quoted strings
- **Quoted strings** (`"..."`) are treated as literal text; no bang or exclude processing occurs inside them

---

## Parser Grammar

### Plain text terms — comma-separated

Multiple plain text search terms must be separated by commas. Each term is ANDed together.

```
youtube, music          → tabs matching "youtube" AND "music"
youtube music           → treated as ONE term: "youtube music"
```

Plain text matches against title and URL by default, unless scoped with `!t` or `!u`.

### Text-scoping bangs (`!t`, `!u`)

These consume **everything following them until a comma or another bang** as their value.

```
!t youtube              → title contains "youtube"
!t hello world          → title contains "hello world"
!t hello world, !audio  → title contains "hello world" AND tab has audio
!t hello, !u google     → title contains "hello" AND url contains "google"
```

### Boolean bangs

Standalone — consume no value.

```
!frozen !audio !pin     → frozen AND playing audio AND pinned
```

### Value bangs (`!ram`, `!gn`, `!gc`)

Consume the next space-separated token(s) as structured values.

```
!ram 500MB >            → RAM usage greater than 500MB
!ram 2GB <              → RAM usage less than 2GB
!gn work                → group name is "work"
!gc blue                → group color is blue
```

### Commands

Appear anywhere in the query, act on the full result set.

```
!audio /freeze          → freeze all tabs playing audio
old 7d /delete          → delete all tabs older than 7 days
```

### Full example

```
youtube, !t music video, !audio, !ram 500MB >, old 2h /delete
```
→ Delete tabs that: contain "youtube" AND have title containing "music video" AND are playing audio AND use >500MB RAM AND are older than 2 hours.

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
youtube, !audio                          → tabs matching "youtube" AND playing audio
!ram 1GB > /freeze                       → freeze all tabs using more than 1GB of RAM
!grouped, !gn work, old 1d               → grouped tabs named "work" older than 1 day
-!frozen, !pin                           → pinned tabs that are NOT frozen
!local, !u localhost                     → local tabs with "localhost" in the URL
!ram 500MB >, old 2h /delete             → delete tabs using >500MB RAM open for 2+ hours
!t music video, !audio                   → title contains "music video" AND has audio
!yt                                      → (custom bang) alias for e.g. !u youtube.com, !audio
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
