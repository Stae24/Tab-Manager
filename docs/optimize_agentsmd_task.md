# TASK: Audit and Optimize AI Context Files (AGENTS.md / CLAUDE.md)

## 🎯 Objective
You are tasked with auditing, rewriting, adding, or deleting all AI context files (e.g., `AGENTS.md`, `CLAUDE.md`, `.clauderc`) across this repository and its subdirectories. 

Your goal is to align the repository's context files with recent empirical software engineering research, which proves that bloated, auto-generated context files **reduce AI success rates by 2%**, **increase inference costs by >20%**, and **cause cognitive overload**. 

You must aggressively prune these files to be strictly minimal, execution-focused, and free of redundancy.

---

## 🔬 The Science (Why You Are Doing This)
Recent benchmarks (*Evaluating AGENTS.md*, Gloaguen et al., 2026) revealed the following about AI coding agents:
1. **Overviews are Harmful:** Codebase overviews and directory trees do not help agents find files faster. They waste context window and increase step counts.
2. **Redundancy degrades performance:** If an instruction exists in standard documentation (`README.md`, `CONTRIBUTING.md`), repeating it in `AGENTS.md` lowers task success rates.
3. **General advice is dead weight:** Agents already know how to write "clean, modular code."
4. **Tooling commands are highly effective:** Agents perfectly follow explicit, niche tool commands (e.g., "Use `uv run pytest`" instead of `pip`). 

---

## 📜 Strict Rules for Context Files

### Rule 1: Zero Codebase Overviews & Architecture
**DO NOT** include explanations of project architecture, routing, or directory structures.
* ❌ **DELETE:** "The `/src` folder contains the backend API, and `/tests` contains the unit tests."
* ❌ **DELETE:** Any ASCII directory trees.
* Agents (including you) are expected to use native shell tools (`ls`, `grep`, `find`) to explore the codebase dynamically. 

### Rule 2: Eradicate Redundancy
Read the root `README.md` and `docs/` folder. If a piece of information (how to install dependencies, business logic, contribution guidelines) is already clearly documented there, **DELETE it from `AGENTS.md`**. `AGENTS.md` is strictly for agent-specific operational directives, not general human onboarding.

### Rule 3: Subdirectory Strictness (Monorepos Only)
Deeply nested context files cause context fragmentation and token bloat. 
* **DELETE** any `AGENTS.md` nested deeply inside standard module folders (e.g., `/src/utils/AGENTS.md` or `/app/components/buttons/AGENTS.md`).
* **KEEP OR ADD** subdirectory `AGENTS.md` files **ONLY** at major technology stack boundaries in a monorepo. 
    * *Example:* It is acceptable to have `/frontend/AGENTS.md` (Node/React rules) and `/backend/AGENTS.md` (Python/Django rules).
* If this repository is a single-stack project, **DELETE ALL** subdirectory context files and consolidate the necessary tooling commands into a single root `AGENTS.md`.

### Rule 4: Focus 100% on Execution & Verification
The rewritten context files must resemble a minimal, strict checklist. They should only contain:
1. Exact, copy-pasteable terminal commands for niche or modern tooling (e.g., `uv`, `pdm`, `pnpm`, specific `make` targets).
2. The required verification loop (forcing the agent to run tests before completing a task).

---

## 📝 Format Examples

### ❌ BAD `AGENTS.md` (Delete and rewrite this pattern)
```markdown
# Welcome AI Agent
This is the backend for our SaaS app. It is built with Python.

## Directory Structure
- `/api`: Contains the endpoints
- `/models`: Database schemas

## Guidelines
Please write clean, modular, and well-documented code. Ensure you add type hints. 
Read the README.md for more info.
```

### ✅ GOOD `AGENTS.md` (Adopt this pattern)
```markdown
# Agent Directives

**1. Tooling**
* Dependency management: `uv` (Do not use `pip`)
* Formatting: `uv run ruff check --fix .`

**2. Verification Loop**
* Before finishing any task, you MUST run tests for the specific file you modified using: `uv run pytest <path-to-test-file>`
* If tests fail, fix the code and re-run until passing.
```

---

## 🚀 Execution Plan

Please execute this task by following these exact steps:

1. **Reconnaissance:** Run `find . -name "AGENTS.md" -o -name "CLAUDE.md" -o -name ".clauderc"` to locate all existing context files.
2. **Documentation Check:** Read the root `README.md` (and `package.json` or `pyproject.toml` if applicable) to understand the stack and identify redundant documentation.
3. **Prune Subdirectories:** Delete any context files that violate **Rule 3** (deep nesting / non-monorepo subdirectories).
4. **Rewrite Root/Valid Files:** Rewrite the remaining context files to strictly match the **✅ GOOD** format. Remove all overviews, architecture explanations, and general advice. 
5. **Report:** When finished, output a brief summary of the files you deleted, the files you rewrote, and the total lines of text you successfully pruned from the AI context.