# Agent Skills

Claude Code skills repo for YO Protocol (`yoprotocol/agent-skills`).

## Structure

- `skills/<name>/SKILL.md` — skill definition (YAML frontmatter + markdown body)
- `skills/<name>/references/` — supporting context files referenced by the skill
- `justfile` — task runner (`just sync` commits here, installs to `~/.agents`, commits there)

## Conventions

- Skills follow Claude Code plugin format: YAML frontmatter (`name`, `description`) + markdown instructions
- `references/` paths in SKILL.md are relative to the skill directory
- Markdown formatted with `mdformat` (gfm + frontmatter plugins): `just mw`
