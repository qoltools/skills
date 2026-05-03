# Skills

A curated collection of **Agent Skills** for AI coding agents.

## What is this?

This repository contains a collection of skills that extend the capabilities of AI coding agents. Each skill packages specialized knowledge, workflows, and tools for specific technologies or automation tasks.

Skills are automatically loaded by agents when they detect a task that matches the skill's domain, providing contextual expertise without manual intervention.

## What is an Agent Skill?

An **Agent Skill** is a lightweight, open-standard format for extending an AI agent's capabilities. It is platform-agnostic and supported by:

- Claude Code
- OpenCode
- Cursor
- GitHub Copilot
- VS Code
- Gemini CLI
- Goose
- Roo Code
- And many others

At minimum, a skill is a folder containing a `SKILL.md` file with metadata and instructions. Skills can also bundle scripts, references, templates, and other resources that the agent can use on demand.

## Available Skills

| Skill                          | Description                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [replicate](skills/replicate/) | Run AI models on Replicate for generating images, videos, editing images, upscaling, and fine-tuning |

## Installation

Install any skill from this repository using [skills.sh](https://skills.sh):

```bash
npx skills add https://github.com/qoltools/skills --skill <skill-name>
```

For example, to install the Replicate skill:

```bash
npx skills add https://github.com/qoltools/skills --skill replicate
```

Once installed, your agent will automatically load and use the skill when relevant tasks are detected.

## Repository Structure

```
skills/
└── <skill-name>/
    ├── SKILL.md          # Required: metadata + instructions
    ├── scripts/          # Optional: executable code
    ├── references/       # Optional: docs, schemas, examples
    └── assets/           # Optional: templates, images, resources
```

## Contributing

Want to add a new skill? Check out the [AGENTS.md](AGENTS.md) file for detailed conventions and guidelines on creating skills, including:

- Skill anatomy and structure
- Writing effective SKILL.md files
- Creating scripts and executables
- Security considerations
- Output conventions

## How Skills Work

Skills use progressive disclosure to minimize context usage:

1. **Metadata** (name, description) — loaded at startup
2. **Instructions** (main body of SKILL.md) — loaded when a task matches
3. **Resources** (scripts, references) — loaded on demand via filesystem

This means agents only load what they need, when they need it.

## License

MIT
