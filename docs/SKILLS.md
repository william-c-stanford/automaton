# Skills System

> `src/skills/` — Dynamic capability loading from SKILL.md files.

## Overview

Skills are instructions in markdown format with YAML frontmatter. They extend
the automaton's capabilities by injecting context into the system prompt.
Skills can be loaded from disk, installed from git repos or URLs, or self-authored.

## SKILL.md Format (`format.ts`)

```markdown
---
name: skill-name
description: "What this skill does"
auto-activate: true
requires:
  bins: [node, npm]
  env: [SOME_API_KEY]
---

# Skill Instructions

Detailed instructions in markdown format.
The automaton will see this in its system prompt.
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique skill identifier |
| `description` | Yes | Short description |
| `auto-activate` | No | If true, instructions are always in prompt (default: false) |
| `requires.bins` | No | Binary dependencies to check |
| `requires.env` | No | Environment variables to check |

## Loading (`loader.ts`)

`loadSkills(skillsDir, db)` scans `~/.automaton/skills/` recursively for
`SKILL.md` files. Each skill is parsed, requirement-checked, and synced to
the database.

`getActiveSkillInstructions(skills)` concatenates instructions from all
auto-activated and enabled skills for injection into the system prompt.

`checkRequirements(skill)` verifies binary and environment dependencies.

## Registry (`registry.ts`)

### Installation Sources

| Source | Function | How |
|--------|----------|-----|
| Git | `installSkillFromGit(repoUrl, name, skillsDir, db, conway)` | Clone repo into skills directory |
| URL | `installSkillFromUrl(url, name, skillsDir, db, conway)` | Download single SKILL.md |
| Self | `createSkill(name, description, instructions, skillsDir, db, conway)` | Agent writes new skill |

### Management

| Function | Purpose |
|----------|---------|
| `removeSkill(name, db, conway, skillsDir, deleteFiles)` | Disable or delete |
| `listSkills(db)` | Get all installed skills |

## Default Skills

Created during setup (`src/setup/defaults.ts`):

| Skill | Purpose |
|-------|---------|
| `conway-compute` | Sandbox and resource management guidance |
| `conway-payments` | x402 and financial operations guidance |
| `survival` | Funding strategies and tier management guidance |

## Database Table

`skills` table stores:
- name, description, auto_activate, instructions, source, path, enabled, installed_at

## Skill Lifecycle

```
Install (git/url/self)
  -> Write SKILL.md to ~/.automaton/skills/<name>/
  -> Parse frontmatter and instructions
  -> Check requirements
  -> Upsert to database
  -> Log modification to audit trail
  -> Available in next agent loop turn
```

## Related Files

- [SYSTEM_PROMPT.md](SYSTEM_PROMPT.md) — Layer 5: active skill injection
- [TOOLS.md](TOOLS.md) — `install_skill`, `create_skill`, `list_skills`, `remove_skill`
- [SELF_MODIFICATION.md](SELF_MODIFICATION.md) — Skill changes are audited
