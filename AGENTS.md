# AGENTS.md

## 1. Project Purpose

This repository is a curated collection of **Agent Skills** for AI agents. Each skill packages specialized knowledge, workflows, and tools for specific technologies or automation tasks.

When the user asks for a "skill" or requests capabilities for a specific technology, your job is to create or update a skill directory under `skills/<skill-name>/` following the open standard documented below.

## 2. What is an Agent Skill?

An **Agent Skill** is a lightweight, open-standard format for extending an AI agent's capabilities. It is platform-agnostic: supported by Claude Code, OpenCode, Cursor, GitHub Copilot, VS Code, Gemini CLI, Goose, Roo Code, and many others.

At minimum, a skill is a folder containing a `SKILL.md` file with metadata and instructions. Skills can also bundle scripts, references, templates, and other resources.

## 3. Skill Anatomy

Every skill must follow this structure:

```
skills/<skill-name>/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: docs, schemas, examples
├── assets/           # Optional: templates, images, resources
└── ...               # Any additional files as needed
```

### SKILL.md Requirements

The `SKILL.md` file is mandatory. It must contain:

1. **YAML Frontmatter** (at the very top):

   ```yaml
   ---
   name: your-skill-name
   description: Brief description of what this skill does and when to use it. Include trigger keywords.
   ---
   ```

2. **Markdown Body** with instructions, workflows, best practices, and examples.

#### Field Rules

- `name`:
  - Max 64 characters.
  - Lowercase letters, numbers, and hyphens only (`kebab-case`).
  - No XML tags.
  - No reserved words like "anthropic" or "claude".

- `description`:
  - Must be non-empty.
  - Max 1024 characters.
  - No XML tags.
  - Must explain **what the skill does** and **when to activate it** (triggers).

## 4. How Skills Load (Progressive Disclosure)

Skills are loaded in three stages to minimize context usage:

| Level               | Content                                        | When Loaded                                 | Token Cost                                                     |
| ------------------- | ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| **1: Metadata**     | `name` and `description` from YAML frontmatter | Always at startup                           | ~100 tokens per skill                                          |
| **2: Instructions** | Main body of `SKILL.md`                        | When a task matches the skill's description | Typically < 5k tokens                                          |
| **3: Resources**    | Additional files (scripts, references, etc.)   | On demand, via filesystem access            | Effectively unlimited (code never enters context, only output) |

**Implication for the agent:** Do not read the full contents of a skill unless the current task matches its description. Load only what is needed.

## 5. Guidelines for Creating a Skill

When the user requests a new skill, follow these rules:

1. **Create the directory**: `skills/<skill-name>/`.
2. **Write `SKILL.md`** with valid YAML frontmatter.
3. **Description must include triggers**: specify keywords or task types that activate the skill.
4. **Write actionable instructions**: clear steps, code examples, conventions, and best practices.
5. **Use scripts for deterministic operations**: if a task is repeatable and does not need LLM reasoning, provide a script instead of asking the agent to generate code.
6. **Everything in English**: code, identifiers, documentation, and comments must be in English.
7. **No secrets**: never hardcode API keys, tokens, credentials, or personal data.
8. **Platform-agnostic**: do not assume the skill only runs on Claude Code or any single agent. Use standard tools and formats.
9. **Keep it focused**: a skill should solve one domain or technology well. Do not bundle unrelated capabilities.

### 5.1 Scripts and Executables

When a skill includes executable scripts, follow these conventions:

**Location and naming:**

- Place scripts in `skills/<skill-name>/scripts/`.
- Name the main entry point `index.ts`, `index.js`, or `main.py`.
- Use descriptive names for auxiliary scripts (e.g., `poll.ts`, `upload.ts`).

**Code style:**

- Use classes organized by resource (e.g., `PredictionsResource`, `ModelsResource`).
- Document all public classes and methods with TSDoc/JSDoc.
- Keep everything in English: code, identifiers, comments, and docs.
- Prefer explicit code over hidden magic. Use guard clauses and early exits.

**Dependencies:**

- Prefer zero external dependencies. Use runtime-native APIs (`fetch`, `Bun.file()`, `FormData`, etc.).
- For Bun/TypeScript, do not add `package.json` or `node_modules`.
- If an external dependency is strictly necessary, justify it in `SKILL.md`.

**CLI pattern:**

```bash
bun run scripts/index.ts <resource> <action> [args...] [--key=value ...]
```

- Use positional subcommands (`<resource> <action>`).
- Use positional arguments for IDs and values.
- Use `--key=value` flags for optional parameters.
- Do not use `--input` or `--file` flags for complex JSON; pass it as a positional argument.

**Output conventions:**

- `stdout`: Markdown-formatted text for complex results, plain text for simple messages.
  - **Simple messages** (one line, errors, confirmations): use plain text without Markdown formatting.
    - Example: `Error: API_KEY environment variable is required. Set it with: export API_KEY=<your_key>`
    - Example: `Prediction canceled successfully.`
  - **Complex results** (objects, lists, nested data): use Markdown with clear headings, bullet points, and code blocks.
    - Use `# Result` or `## <Resource> Result` as the main heading.
    - Use bullet points (`-`) for listing fields and values.
    - Use code blocks for JSON snippets, URLs, or commands.
  - **Avoid tables** when possible; prefer bullet points or lists for structured data.
- `stderr`: usage messages, logs, debug info, and human-readable diagnostics.
- On error: return a clear, actionable plain text message. If the error needs explanation, use a short Markdown format with `## Error` heading.
- On success: use plain text for simple confirmations, Markdown for structured data.

**Error handling:**

- Missing environment variable:
  ```
  Error: API_KEY environment variable is required. Set it with: export API_KEY=<your_key> (Status: 401)
  ```
- Invalid arguments:
  ```
  Error: Invalid arguments for predictions create. Usage: bun run scripts/index.ts predictions create <version> <input_json> (Status: 400)
  ```
- API error:
  ```
  Error: Replicate API error (404): Not found (Status: 404)
  ```
- Network error:
  ```
  Error: Network error: fetch failed (Status: 0)
  ```

**Security:**

- Never hardcode API keys, tokens, credentials, or personal data in scripts.
- Read credentials from environment variables (`process.env.API_KEY`).
- Validate that the variable exists and is not empty before executing.
- Return a clear, actionable error message if the variable is missing.

**Bun-specific requirements:**

- If the script uses Bun, `SKILL.md` must include an **"Installation"** section explaining how to install Bun.
- Include instructions for macOS, Linux, Windows, npm, Homebrew, Scoop, and Docker.
- Highlight that if Bun is not installed, the agent must ask the user if they want to install it.
- Reference [bun.com/docs/installation](https://bun.com/docs/installation) for future updates.

## 6. Security Considerations

Skills contain instructions and executable code that the agent will follow. Treat them as installed software.

- **Audit before use**: review all files in a skill (`SKILL.md`, scripts, resources) for unexpected network calls, file access, or malicious patterns.
- **Untrusted sources are risky**: skills from unknown sources may misuse tools (bash, file operations) or exfiltrate data.
- **No secrets in skills**: if a skill needs credentials, instruct the user to provide them via environment variables or secure vaults, never hardcoded.

---

**Reference:** This standard is based on the open Agent Skills specification ([agentskills.io](https://agentskills.io/home)) and is compatible with Claude, OpenCode, Cursor, Copilot, and other agentic tools.
