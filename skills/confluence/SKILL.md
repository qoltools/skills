---
name: confluence
description: Interact with the Confluence Cloud REST API to manage pages, spaces, blog posts, attachments, labels, comments, users, and search content with CQL. Activate when the user asks to create or update a Confluence page, manage a wiki space, upload an attachment, add or remove labels, post or manage comments, search wiki content with CQL, manage blog posts, invite users, or work with Confluence API operations.
---

# Confluence Cloud Skill

Interact with the [Confluence Cloud REST API](https://developer.atlassian.com/cloud/confluence/rest/v2/) using a Bun TypeScript CLI. This skill covers **API v2** endpoints and falls back to **API v1** for operations not yet available in v2 (attachment uploads, CQL search, label management).

## What is Confluence Cloud?

Confluence is Atlassian's collaborative workspace for creating, organizing, and sharing knowledge. This skill lets agents automate page and space management, content creation, file attachments, comments, and search via the REST API.

## Requirements

- **Bun** runtime (see Installation section below)
- **CONFLUENCE_BASE_URL** — Your Confluence Cloud URL, e.g. `https://yourcompany.atlassian.net`
- **CONFLUENCE_EMAIL** — Your Atlassian account email
- **CONFLUENCE_API_TOKEN** — Generate at https://id.atlassian.com/manage-profile/security/api-tokens

## Setup

```bash
export CONFLUENCE_BASE_URL="https://yourcompany.atlassian.net"
export CONFLUENCE_EMAIL="you@example.com"
export CONFLUENCE_API_TOKEN="ATATT..."
```

Never hardcode credentials. Always use environment variables.

## Installation

### If Bun is not installed

Bun is a fast JavaScript runtime. If it is not available on the system, ask the user if they want to install it.

**macOS & Linux:**

```bash
curl -fsSL https://bun.com/install | bash
```

**Windows:**

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

**npm:**

```bash
npm install -g bun
```

**Homebrew:**

```bash
brew install oven-sh/bun/bun
```

**Scoop:**

```bash
scoop install bun
```

**Docker:**

```bash
docker pull oven/bun
```

After installation, verify:

```bash
bun --version
```

If `bun: command not found`, add `~/.bun/bin` to your PATH:

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

## Usage

All commands follow this pattern:

```bash
bun run skills/confluence/scripts/index.ts <resource> <action> [args...] [--key=value ...]
```

- Use positional subcommands (`<resource> <action>`)
- Use positional arguments for IDs and values
- Use `--key=value` flags for optional query parameters
- Pass JSON bodies as positional string arguments

## Command Reference

### spaces

**`list`** — List all spaces.

```bash
bun run skills/confluence/scripts/index.ts spaces list [--keys=KEY1,KEY2] [--type=global] [--limit=N] [--cursor=CURSOR]
```

**`get`** — Get a specific space by ID.

```bash
bun run skills/confluence/scripts/index.ts spaces get <space_id> [--include-icon=true] [--include-permissions=true]
```

**`create`** — Create a new space.

```bash
bun run skills/confluence/scripts/index.ts spaces create '{"name":"My Space","key":"MYSPACE"}'
```

### pages

**`list`** — List all pages with optional filters.

```bash
bun run skills/confluence/scripts/index.ts pages list [--space-id=ID] [--status=current] [--title=TEXT] [--limit=N] [--cursor=CURSOR]
```

**`get`** — Get a page by ID.

```bash
bun run skills/confluence/scripts/index.ts pages get <page_id> [--body-format=storage] [--include-labels=true]
```

**`create`** — Create a page in a space.

```bash
bun run skills/confluence/scripts/index.ts pages create '{"spaceId":"123","title":"Hello","body":{"representation":"storage","value":"<p>World</p>"}}'
```

**`update`** — Update a page by ID.

```bash
bun run skills/confluence/scripts/index.ts pages update <page_id> '{"id":"123","status":"current","title":"Updated","body":{"representation":"storage","value":"<p>New</p>"},"version":{"number":2}}'
```

**`delete`** — Delete a page (moves to trash). Use `--purge=true` to permanently delete a trashed page. Use `--draft=true` to delete a draft.

```bash
bun run skills/confluence/scripts/index.ts pages delete <page_id> [--purge=true] [--draft=true]
```

**`update-title`** — Update only a page's title.

```bash
bun run skills/confluence/scripts/index.ts pages update-title <page_id> '{"status":"current","title":"New Title"}'
```

**`list-by-space`** — List pages within a space.

```bash
bun run skills/confluence/scripts/index.ts pages list-by-space <space_id> [--depth=root] [--limit=N]
```

### blog-posts

**`list`** — List all blog posts.

```bash
bun run skills/confluence/scripts/index.ts blog-posts list [--space-id=ID] [--status=current] [--limit=N]
```

**`get`** — Get a blog post by ID.

```bash
bun run skills/confluence/scripts/index.ts blog-posts get <blog_post_id> [--body-format=storage]
```

**`create`** — Create a blog post.

```bash
bun run skills/confluence/scripts/index.ts blog-posts create '{"spaceId":"123","title":"Weekly Update","body":{"representation":"storage","value":"<p>News</p>"}}'
```

**`update`** — Update a blog post.

```bash
bun run skills/confluence/scripts/index.ts blog-posts update <blog_post_id> '{"id":"123","status":"current","title":"Updated","body":{"representation":"storage","value":"<p>New</p>"},"version":{"number":2}}'
```

**`delete`** — Delete a blog post.

```bash
bun run skills/confluence/scripts/index.ts blog-posts delete <blog_post_id> [--purge=true] [--draft=true]
```

**`list-by-space`** — List blog posts in a space.

```bash
bun run skills/confluence/scripts/index.ts blog-posts list-by-space <space_id> [--limit=N]
```

### attachments

**`list`** — List all attachments.

```bash
bun run skills/confluence/scripts/index.ts attachments list [--filename=NAME] [--limit=N] [--cursor=CURSOR]
```

**`get`** — Get an attachment by ID.

```bash
bun run skills/confluence/scripts/index.ts attachments get <attachment_id>
```

**`delete`** — Delete an attachment. Use `--purge=true` for permanent deletion.

```bash
bun run skills/confluence/scripts/index.ts attachments delete <attachment_id> [--purge=true]
```

**`list-by-page`** — List attachments for a page.

```bash
bun run skills/confluence/scripts/index.ts attachments list-by-page <page_id> [--limit=N]
```

**`download`** — Get the download URL for an attachment.

```bash
bun run skills/confluence/scripts/index.ts attachments download <attachment_id> [--version=N]
```

**`upload`** — Upload a file to a page (uses v1 API).

```bash
bun run skills/confluence/scripts/index.ts attachments upload <page_id> <file_path> [--comment="File upload"]
```

### labels

**`list`** — List all labels.

```bash
bun run skills/confluence/scripts/index.ts labels list [--limit=N] [--cursor=CURSOR]
```

**`get`** — Get a label by ID (alias for list with filter).

```bash
bun run skills/confluence/scripts/index.ts labels get <label_id>
```

**`list-by-page`** — List labels on a page.

```bash
bun run skills/confluence/scripts/index.ts labels list-by-page <page_id>
```

**`list-by-space`** — List labels in a space.

```bash
bun run skills/confluence/scripts/index.ts labels list-by-space <space_id>
```

**`add-to-page`** — Add a label to a page (uses v1 API).

```bash
bun run skills/confluence/scripts/index.ts labels add-to-page <page_id> <label_name>
```

**`remove-from-page`** — Remove a label from a page (uses v1 API).

```bash
bun run skills/confluence/scripts/index.ts labels remove-from-page <page_id> <label_name>
```

### comments

**`list-footer`** — List all footer comments.

```bash
bun run skills/confluence/scripts/index.ts comments list-footer [--limit=N]
```

**`get-footer`** — Get a footer comment by ID.

```bash
bun run skills/confluence/scripts/index.ts comments get-footer <comment_id>
```

**`create-footer`** — Create a footer comment.

```bash
bun run skills/confluence/scripts/index.ts comments create-footer '{"pageId":"123","body":{"representation":"storage","value":"<p>Nice page!</p>"}}'
```

**`update-footer`** — Update a footer comment.

```bash
bun run skills/confluence/scripts/index.ts comments update-footer <comment_id> '{"version":{"number":2},"body":{"representation":"storage","value":"<p>Updated</p>"}}'
```

**`delete-footer`** — Delete a footer comment.

```bash
bun run skills/confluence/scripts/index.ts comments delete-footer <comment_id>
```

**`list-inline`** — List all inline comments.

```bash
bun run skills/confluence/scripts/index.ts comments list-inline [--limit=N]
```

**`get-inline`** — Get an inline comment by ID.

```bash
bun run skills/confluence/scripts/index.ts comments get-inline <comment_id>
```

**`create-inline`** — Create an inline comment.

```bash
bun run skills/confluence/scripts/index.ts comments create-inline '{"pageId":"123","body":{"representation":"storage","value":"<p>Fix this</p>"},"inlineCommentProperties":{"textSelection":"some text","textSelectionMatchCount":1,"textSelectionMatchIndex":0}}'
```

**`update-inline`** — Update an inline comment (can also resolve it).

```bash
bun run skills/confluence/scripts/index.ts comments update-inline <comment_id> '{"version":{"number":2},"body":{"representation":"storage","value":"<p>Fixed</p>"},"resolved":true}'
```

**`delete-inline`** — Delete an inline comment.

```bash
bun run skills/confluence/scripts/index.ts comments delete-inline <comment_id>
```

**`list-by-page`** — List comments on a page (both footer and inline).

```bash
bun run skills/confluence/scripts/index.ts comments list-by-page <page_id> [--type=footer|inline]
```

### users

**`bulk-lookup`** — Lookup users by Atlassian account IDs.

```bash
bun run skills/confluence/scripts/index.ts users bulk-lookup '["123456:abc-def","123456:ghi-jkl"]'
```

**`check-access`** — Check which emails do not have site access.

```bash
bun run skills/confluence/scripts/index.ts users check-access '["user1@example.com","user2@example.com"]'
```

**`invite`** — Invite a list of emails to the site.

```bash
bun run skills/confluence/scripts/index.ts users invite '["newuser@example.com"]'
```

### search

**`cql`** — Search content using Confluence Query Language (uses v1 API).

```bash
bun run skills/confluence/scripts/index.ts search cql "type=page AND space=MYSPACE" [--limit=N] [--start=N]
```

## Examples

### Create a page and attach a file

```bash
# 1. Create the page
bun run skills/confluence/scripts/index.ts pages create \
  '{"spaceId":"123","title":"Project Spec","body":{"representation":"storage","value":"<p>Details here</p>"}}'

# 2. Upload an attachment to the page
bun run skills/confluence/scripts/index.ts attachments upload <page_id> ./spec.pdf
```

### Search for outdated pages

```bash
bun run skills/confluence/scripts/index.ts search cql "type=page AND lastModified < '2025-01-01'" --limit=50
```

### List all spaces and their keys

```bash
bun run skills/confluence/scripts/index.ts spaces list --limit=100
```

### Add a label to a page

```bash
bun run skills/confluence/scripts/index.ts labels add-to-page <page_id> documentation
```

### Create a blog post

```bash
bun run skills/confluence/scripts/index.ts blog-posts create \
  '{"spaceId":"123","title":"Sprint 42 Retrospective","body":{"representation":"storage","value":"<p>What went well...</p>"}}'
```

## Pagination

The Confluence API v2 uses cursor-based pagination. When listing resources:

1. Make the request with `--limit=N`
2. If the response includes `_links.next`, copy the cursor value
3. Pass it as `--cursor=<cursor>` in the next request

For v1 search (CQL), use `--start=N` for offset pagination.

## Body Representations

When creating/updating content bodies, these representations are supported:

- `storage` — Confluence Storage Format (XHTML). This is the default and most compatible.
- `atlas_doc_format` — Atlassian Document Format (JSON).

Always prefer `storage` unless you have a specific reason to use ADF.

## Error Handling

The script handles all errors and returns clear messages:

**Missing environment variable:**

```
Error: CONFLUENCE_BASE_URL environment variable is required. Set it with: export CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net (Status: 401)
```

**Invalid arguments:**

```
Error: Invalid arguments for pages create. Usage: bun run scripts/index.ts pages create <body_json> (Status: 400)
```

**API error:**

```
Error: Confluence API error (404): Not found (Status: 404)
```

**Network error:**

```
Error: Network error: fetch failed (Status: 0)
```

## Security

- Never log or expose `CONFLUENCE_API_TOKEN`.
- Never commit credentials to version control.
- The script reads credentials exclusively from environment variables.
- All requests use HTTPS.

## Rate Limits

Confluence Cloud has rate limits. If you hit them, the API returns `429 Too Many Requests`. The script does not implement automatic retries — wait a few seconds and retry.

## Sources for Future Updates

- **API v2 Documentation**: https://developer.atlassian.com/cloud/confluence/rest/v2/
- **API v1 Documentation**: https://developer.atlassian.com/cloud/confluence/rest/v1/
- **CQL Reference**: https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/
- **API Tokens**: https://id.atlassian.com/manage-profile/security/api-tokens
- **Bun Installation Docs**: https://bun.com/docs/installation
