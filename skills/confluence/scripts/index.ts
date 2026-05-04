#!/usr/bin/env bun
/**
 * Confluence Cloud API CLI
 *
 * A Bun-based TypeScript CLI for the Confluence Cloud REST API.
 * Covers API v2 endpoints and falls back to v1 for attachment uploads,
 * CQL search, and label management.
 *
 * Usage:
 *   bun run scripts/index.ts <resource> <action> [positional_args...] [--key=value ...]
 */

/* -------------------------------------------------------------------------- */
/*                                 TYPES                                      */
/* -------------------------------------------------------------------------- */

interface ParsedArgs {
  args: string[];
  flags: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/*                                 CLIENT                                     */
/* -------------------------------------------------------------------------- */

class ConfluenceClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor() {
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const email = process.env.CONFLUENCE_EMAIL;
    const token = process.env.CONFLUENCE_API_TOKEN;

    if (!baseUrl) {
      throw new Error(
        "CONFLUENCE_BASE_URL environment variable is required. Set it with: export CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net (Status: 401)",
      );
    }
    if (!email) {
      throw new Error(
        "CONFLUENCE_EMAIL environment variable is required. Set it with: export CONFLUENCE_EMAIL=you@example.com (Status: 401)",
      );
    }
    if (!token) {
      throw new Error(
        "CONFLUENCE_API_TOKEN environment variable is required. Generate at https://id.atlassian.com/manage-profile/security/api-tokens (Status: 401)",
      );
    }

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = "Basic " + btoa(`${email}:${token}`);
  }

  async request(
    path: string,
    options: RequestInit = {},
    isV1: boolean = false,
  ): Promise<unknown> {
    const prefix = isV1 ? "/wiki/rest/api" : "/wiki/api/v2";
    const url = `${this.baseUrl}${prefix}${path}`;

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // If body is a string and Content-Type is not set, set it
    if (
      typeof options.body === "string" &&
      !headers["Content-Type"] &&
      !headers["content-type"]
    ) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error: ${message} (Status: 0)`);
    }

    if (response.status >= 200 && response.status < 300) {
      const text = await response.text();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.message) errorMessage = parsed.message;
      else if (parsed.errorMessages?.length)
        errorMessage = parsed.errorMessages.join(", ");
      else if (parsed.errors?.length) errorMessage = parsed.errors.join(", ");
    } catch {
      // keep raw text
    }

    throw new Error(
      `Confluence API error (${response.status}): ${errorMessage} (Status: ${response.status})`,
    );
  }

  buildQueryString(flags: Record<string, string>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(flags)) {
      if (value === undefined || value === null || value === "") continue;
      // Handle arrays in flags (comma-separated)
      if (value.includes(",")) {
        for (const v of value.split(",")) {
          params.append(key, v.trim());
        }
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }
}

/* -------------------------------------------------------------------------- */
/*                               FORMATTER                                    */
/* -------------------------------------------------------------------------- */

function formatOutput(data: unknown, title?: string): void {
  if (data === undefined || data === null) {
    console.log("Success.");
    return;
  }

  if (typeof data === "string") {
    console.log(data);
    return;
  }

  if (title) {
    console.log(`# ${title}`);
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      console.log("");
      formatObject(item, 0);
    }
  } else if (typeof data === "object" && data !== null) {
    formatObject(data, 0);
  } else {
    console.log(String(data));
  }
}

function formatObject(obj: unknown, depth: number): void {
  const indent = "  ".repeat(depth);
  if (obj === null || obj === undefined) {
    console.log(`${indent}- null`);
    return;
  }
  if (typeof obj !== "object") {
    console.log(`${indent}- ${String(obj)}`);
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        console.log(`${indent}-`);
        formatObject(item, depth + 1);
      } else {
        console.log(`${indent}- ${String(item)}`);
      }
    }
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      // Skip nested _links and meta objects for brevity, unless they are the only thing
      if (key === "_links" || key === "meta") continue;
      console.log(`${indent}- **${key}**:`);
      formatObject(value, depth + 1);
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (value.every((v) => typeof v !== "object")) {
        console.log(`${indent}- **${key}**: ${value.join(", ")}`);
      } else {
        console.log(`${indent}- **${key}**: (${value.length} items)`);
        for (const item of value.slice(0, 5)) {
          formatObject(item, depth + 1);
        }
        if (value.length > 5) {
          console.log(`${indent}  ... and ${value.length - 5} more`);
        }
      }
    } else {
      console.log(`${indent}- **${key}**: ${String(value)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               RESOURCES                                    */
/* -------------------------------------------------------------------------- */

class SpacesResource {
  constructor(private client: ConfluenceClient) {}

  async list(args: string[], flags: Record<string, string>): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = (await this.client.request(`/spaces${qs}`)) as Record<
      string,
      unknown
    >;
    formatOutput(data, "Spaces Result");
  }

  async get(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for spaces get. Usage: bun run scripts/index.ts spaces get <space_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/spaces/${args[0]}${qs}`);
    formatOutput(data, "Space Result");
  }

  async create(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for spaces create. Usage: bun run scripts/index.ts spaces create <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[0]);
    } catch {
      throw new Error(
        'Invalid JSON body. Usage: bun run scripts/index.ts spaces create \'{"name":"..."}\' (Status: 400)',
      );
    }
    const data = await this.client.request(`/spaces`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Space Created");
  }
}

class PagesResource {
  constructor(private client: ConfluenceClient) {}

  async list(args: string[], flags: Record<string, string>): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/pages${qs}`);
    formatOutput(data, "Pages Result");
  }

  async get(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for pages get. Usage: bun run scripts/index.ts pages get <page_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/pages/${args[0]}${qs}`);
    formatOutput(data, "Page Result");
  }

  async create(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for pages create. Usage: bun run scripts/index.ts pages create <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[0]);
    } catch {
      throw new Error(
        'Invalid JSON body. Usage: bun run scripts/index.ts pages create \'{"spaceId":"..."}\' (Status: 400)',
      );
    }
    const data = await this.client.request(`/pages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Page Created");
  }

  async update(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for pages update. Usage: bun run scripts/index.ts pages update <page_id> <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[1]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/pages/${args[0]}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Page Updated");
  }

  async delete(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for pages delete. Usage: bun run scripts/index.ts pages delete <page_id> [--purge=true] [--draft=true] (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    await this.client.request(`/pages/${args[0]}${qs}`, { method: "DELETE" });
    console.log("Page deleted successfully.");
  }

  async updateTitle(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for pages update-title. Usage: bun run scripts/index.ts pages update-title <page_id> <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[1]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/pages/${args[0]}/title`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Page Title Updated");
  }

  async listBySpace(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for pages list-by-space. Usage: bun run scripts/index.ts pages list-by-space <space_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/spaces/${args[0]}/pages${qs}`);
    formatOutput(data, "Pages in Space");
  }
}

class BlogPostsResource {
  constructor(private client: ConfluenceClient) {}

  async list(args: string[], flags: Record<string, string>): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/blogposts${qs}`);
    formatOutput(data, "Blog Posts Result");
  }

  async get(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for blog-posts get. Usage: bun run scripts/index.ts blog-posts get <blog_post_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/blogposts/${args[0]}${qs}`);
    formatOutput(data, "Blog Post Result");
  }

  async create(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for blog-posts create. Usage: bun run scripts/index.ts blog-posts create <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[0]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/blogposts`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Blog Post Created");
  }

  async update(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for blog-posts update. Usage: bun run scripts/index.ts blog-posts update <blog_post_id> <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[1]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/blogposts/${args[0]}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Blog Post Updated");
  }

  async delete(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for blog-posts delete. Usage: bun run scripts/index.ts blog-posts delete <blog_post_id> [--purge=true] [--draft=true] (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    await this.client.request(`/blogposts/${args[0]}${qs}`, {
      method: "DELETE",
    });
    console.log("Blog post deleted successfully.");
  }

  async listBySpace(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for blog-posts list-by-space. Usage: bun run scripts/index.ts blog-posts list-by-space <space_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/spaces/${args[0]}/blogposts${qs}`);
    formatOutput(data, "Blog Posts in Space");
  }
}

class AttachmentsResource {
  constructor(private client: ConfluenceClient) {}

  async list(args: string[], flags: Record<string, string>): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/attachments${qs}`);
    formatOutput(data, "Attachments Result");
  }

  async get(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for attachments get. Usage: bun run scripts/index.ts attachments get <attachment_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/attachments/${args[0]}${qs}`);
    formatOutput(data, "Attachment Result");
  }

  async delete(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for attachments delete. Usage: bun run scripts/index.ts attachments delete <attachment_id> [--purge=true] (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    await this.client.request(`/attachments/${args[0]}${qs}`, {
      method: "DELETE",
    });
    console.log("Attachment deleted successfully.");
  }

  async listByPage(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for attachments list-by-page. Usage: bun run scripts/index.ts attachments list-by-page <page_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(
      `/pages/${args[0]}/attachments${qs}`,
    );
    formatOutput(data, "Attachments for Page");
  }

  async download(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for attachments download. Usage: bun run scripts/index.ts attachments download <attachment_id> [--version=N] (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(
      `/attachments/${args[0]}/download${qs}`,
    );
    formatOutput(data, "Attachment Download");
  }

  async upload(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for attachments upload. Usage: bun run scripts/index.ts attachments upload <page_id> <file_path> [--comment=TEXT] (Status: 400)",
      );
    }

    const pageId = args[0];
    const filePath = args[1];
    const comment = flags.comment || "";

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath} (Status: 400)`);
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([await file.arrayBuffer()], {
        type: file.type || "application/octet-stream",
      }),
      file.name || "file",
    );
    if (comment) {
      form.append("comment", comment);
    }

    const data = await this.client.request(
      `/content/${pageId}/child/attachment`,
      {
        method: "POST",
        body: form,
        headers: {
          "X-Atlassian-Token": "no-check",
        },
      },
      true, // v1 API
    );
    formatOutput(data, "Attachment Uploaded");
  }
}

class LabelsResource {
  constructor(private client: ConfluenceClient) {}

  async list(args: string[], flags: Record<string, string>): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/labels${qs}`);
    formatOutput(data, "Labels Result");
  }

  async get(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for labels get. Usage: bun run scripts/index.ts labels get <label_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString({ ...flags, "label-id": args[0] });
    const data = await this.client.request(`/labels${qs}`);
    formatOutput(data, "Label Result");
  }

  async listByPage(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for labels list-by-page. Usage: bun run scripts/index.ts labels list-by-page <page_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/pages/${args[0]}/labels${qs}`);
    formatOutput(data, "Labels for Page");
  }

  async listBySpace(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for labels list-by-space. Usage: bun run scripts/index.ts labels list-by-space <space_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/spaces/${args[0]}/labels${qs}`);
    formatOutput(data, "Labels for Space");
  }

  async addToPage(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for labels add-to-page. Usage: bun run scripts/index.ts labels add-to-page <page_id> <label_name> (Status: 400)",
      );
    }
    const body = [{ prefix: "global", name: args[1] }];
    const data = await this.client.request(
      `/content/${args[0]}/label`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true, // v1 API
    );
    formatOutput(data, "Label Added");
  }

  async removeFromPage(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for labels remove-from-page. Usage: bun run scripts/index.ts labels remove-from-page <page_id> <label_name> (Status: 400)",
      );
    }
    await this.client.request(
      `/content/${args[0]}/label/${encodeURIComponent(args[1])}`,
      { method: "DELETE" },
      true, // v1 API
    );
    console.log("Label removed successfully.");
  }
}

class CommentsResource {
  constructor(private client: ConfluenceClient) {}

  async listFooter(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/footer-comments${qs}`);
    formatOutput(data, "Footer Comments Result");
  }

  async getFooter(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments get-footer. Usage: bun run scripts/index.ts comments get-footer <comment_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/footer-comments/${args[0]}${qs}`);
    formatOutput(data, "Footer Comment Result");
  }

  async createFooter(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments create-footer. Usage: bun run scripts/index.ts comments create-footer <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[0]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/footer-comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Footer Comment Created");
  }

  async updateFooter(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for comments update-footer. Usage: bun run scripts/index.ts comments update-footer <comment_id> <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[1]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/footer-comments/${args[0]}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Footer Comment Updated");
  }

  async deleteFooter(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments delete-footer. Usage: bun run scripts/index.ts comments delete-footer <comment_id> (Status: 400)",
      );
    }
    await this.client.request(`/footer-comments/${args[0]}`, {
      method: "DELETE",
    });
    console.log("Footer comment deleted successfully.");
  }

  async listInline(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/inline-comments${qs}`);
    formatOutput(data, "Inline Comments Result");
  }

  async getInline(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments get-inline. Usage: bun run scripts/index.ts comments get-inline <comment_id> (Status: 400)",
      );
    }
    const qs = this.client.buildQueryString(flags);
    const data = await this.client.request(`/inline-comments/${args[0]}${qs}`);
    formatOutput(data, "Inline Comment Result");
  }

  async createInline(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments create-inline. Usage: bun run scripts/index.ts comments create-inline <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[0]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/inline-comments`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Inline Comment Created");
  }

  async updateInline(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0] || !args[1]) {
      throw new Error(
        "Invalid arguments for comments update-inline. Usage: bun run scripts/index.ts comments update-inline <comment_id> <body_json> (Status: 400)",
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(args[1]);
    } catch {
      throw new Error("Invalid JSON body (Status: 400)");
    }
    const data = await this.client.request(`/inline-comments/${args[0]}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    formatOutput(data, "Inline Comment Updated");
  }

  async deleteInline(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments delete-inline. Usage: bun run scripts/index.ts comments delete-inline <comment_id> (Status: 400)",
      );
    }
    await this.client.request(`/inline-comments/${args[0]}`, {
      method: "DELETE",
    });
    console.log("Inline comment deleted successfully.");
  }

  async listByPage(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for comments list-by-page. Usage: bun run scripts/index.ts comments list-by-page <page_id> [--type=footer|inline] (Status: 400)",
      );
    }
    const type = flags.type || "footer";
    const qs = this.client.buildQueryString(
      Object.fromEntries(Object.entries(flags).filter(([k]) => k !== "type")),
    );
    if (type === "inline") {
      const data = await this.client.request(
        `/pages/${args[0]}/inline-comments${qs}`,
      );
      formatOutput(data, "Inline Comments for Page");
    } else {
      const data = await this.client.request(
        `/pages/${args[0]}/footer-comments${qs}`,
      );
      formatOutput(data, "Footer Comments for Page");
    }
  }
}

class UsersResource {
  constructor(private client: ConfluenceClient) {}

  async bulkLookup(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for users bulk-lookup. Usage: bun run scripts/index.ts users bulk-lookup <account_ids_json_array> (Status: 400)",
      );
    }
    let accountIds: string[];
    try {
      accountIds = JSON.parse(args[0]);
      if (!Array.isArray(accountIds)) throw new Error();
    } catch {
      throw new Error("Invalid JSON array for account IDs (Status: 400)");
    }
    const data = await this.client.request(`/users-bulk`, {
      method: "POST",
      body: JSON.stringify({ accountIds }),
    });
    formatOutput(data, "Users Lookup Result");
  }

  async checkAccess(
    args: string[],
    flags: Record<string, string>,
  ): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for users check-access. Usage: bun run scripts/index.ts users check-access <emails_json_array> (Status: 400)",
      );
    }
    let emails: string[];
    try {
      emails = JSON.parse(args[0]);
      if (!Array.isArray(emails)) throw new Error();
    } catch {
      throw new Error("Invalid JSON array for emails (Status: 400)");
    }
    const data = await this.client.request(
      `/user/access/check-access-by-email`,
      {
        method: "POST",
        body: JSON.stringify({ emails }),
      },
    );
    formatOutput(data, "Access Check Result");
  }

  async invite(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for users invite. Usage: bun run scripts/index.ts users invite <emails_json_array> (Status: 400)",
      );
    }
    let emails: string[];
    try {
      emails = JSON.parse(args[0]);
      if (!Array.isArray(emails)) throw new Error();
    } catch {
      throw new Error("Invalid JSON array for emails (Status: 400)");
    }
    const data = await this.client.request(`/user/access/invite-by-email`, {
      method: "POST",
      body: JSON.stringify({ emails }),
    });
    formatOutput(data, "Invite Result");
  }
}

class SearchResource {
  constructor(private client: ConfluenceClient) {}

  async cql(args: string[], flags: Record<string, string>): Promise<void> {
    if (!args[0]) {
      throw new Error(
        "Invalid arguments for search cql. Usage: bun run scripts/index.ts search cql <cql_string> [--limit=N] [--start=N] (Status: 400)",
      );
    }
    const queryFlags: Record<string, string> = { cql: args[0], ...flags };
    const qs = this.client.buildQueryString(queryFlags);
    const data = await this.client.request(`/content/search${qs}`, {}, true); // v1 API
    formatOutput(data, "CQL Search Result");
  }
}

/* -------------------------------------------------------------------------- */
/*                               ARG PARSER                                   */
/* -------------------------------------------------------------------------- */

function parseArgs(argv: string[]): ParsedArgs {
  const args: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=");
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        flags[key] = value;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[arg.slice(2)] = argv[i + 1];
        i++;
      } else {
        flags[arg.slice(2)] = "true";
      }
    } else {
      args.push(arg);
    }
  }

  return { args, flags };
}

/* -------------------------------------------------------------------------- */
/*                                 ROUTER                                     */
/* -------------------------------------------------------------------------- */

function printUsage(): void {
  console.error(`Usage: bun run scripts/index.ts <resource> <action> [args...] [--key=value ...]

Resources and actions:
  spaces          list, get, create
  pages           list, get, create, update, delete, update-title, list-by-space
  blog-posts      list, get, create, update, delete, list-by-space
  attachments     list, get, delete, list-by-page, download, upload
  labels          list, get, list-by-page, list-by-space, add-to-page, remove-from-page
  comments        list-footer, get-footer, create-footer, update-footer, delete-footer,
                  list-inline, get-inline, create-inline, update-inline, delete-inline,
                  list-by-page
  users           bulk-lookup, check-access, invite
  search          cql

Environment variables:
  CONFLUENCE_BASE_URL    Your Confluence Cloud URL
  CONFLUENCE_EMAIL       Your Atlassian account email
  CONFLUENCE_API_TOKEN   Your API token
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    printUsage();
    process.exit(1);
  }

  const [resource, action, ...rest] = argv;
  const { args, flags } = parseArgs(rest);

  const client = new ConfluenceClient();

  const spaces = new SpacesResource(client);
  const pages = new PagesResource(client);
  const blogPosts = new BlogPostsResource(client);
  const attachments = new AttachmentsResource(client);
  const labels = new LabelsResource(client);
  const comments = new CommentsResource(client);
  const users = new UsersResource(client);
  const search = new SearchResource(client);

  try {
    switch (resource) {
      case "spaces": {
        switch (action) {
          case "list":
            await spaces.list(args, flags);
            break;
          case "get":
            await spaces.get(args, flags);
            break;
          case "create":
            await spaces.create(args, flags);
            break;
          default:
            throw new Error(`Unknown action "${action}" for resource "spaces"`);
        }
        break;
      }

      case "pages": {
        switch (action) {
          case "list":
            await pages.list(args, flags);
            break;
          case "get":
            await pages.get(args, flags);
            break;
          case "create":
            await pages.create(args, flags);
            break;
          case "update":
            await pages.update(args, flags);
            break;
          case "delete":
            await pages.delete(args, flags);
            break;
          case "update-title":
            await pages.updateTitle(args, flags);
            break;
          case "list-by-space":
            await pages.listBySpace(args, flags);
            break;
          default:
            throw new Error(`Unknown action "${action}" for resource "pages"`);
        }
        break;
      }

      case "blog-posts": {
        switch (action) {
          case "list":
            await blogPosts.list(args, flags);
            break;
          case "get":
            await blogPosts.get(args, flags);
            break;
          case "create":
            await blogPosts.create(args, flags);
            break;
          case "update":
            await blogPosts.update(args, flags);
            break;
          case "delete":
            await blogPosts.delete(args, flags);
            break;
          case "list-by-space":
            await blogPosts.listBySpace(args, flags);
            break;
          default:
            throw new Error(
              `Unknown action "${action}" for resource "blog-posts"`,
            );
        }
        break;
      }

      case "attachments": {
        switch (action) {
          case "list":
            await attachments.list(args, flags);
            break;
          case "get":
            await attachments.get(args, flags);
            break;
          case "delete":
            await attachments.delete(args, flags);
            break;
          case "list-by-page":
            await attachments.listByPage(args, flags);
            break;
          case "download":
            await attachments.download(args, flags);
            break;
          case "upload":
            await attachments.upload(args, flags);
            break;
          default:
            throw new Error(
              `Unknown action "${action}" for resource "attachments"`,
            );
        }
        break;
      }

      case "labels": {
        switch (action) {
          case "list":
            await labels.list(args, flags);
            break;
          case "get":
            await labels.get(args, flags);
            break;
          case "list-by-page":
            await labels.listByPage(args, flags);
            break;
          case "list-by-space":
            await labels.listBySpace(args, flags);
            break;
          case "add-to-page":
            await labels.addToPage(args, flags);
            break;
          case "remove-from-page":
            await labels.removeFromPage(args, flags);
            break;
          default:
            throw new Error(`Unknown action "${action}" for resource "labels"`);
        }
        break;
      }

      case "comments": {
        switch (action) {
          case "list-footer":
            await comments.listFooter(args, flags);
            break;
          case "get-footer":
            await comments.getFooter(args, flags);
            break;
          case "create-footer":
            await comments.createFooter(args, flags);
            break;
          case "update-footer":
            await comments.updateFooter(args, flags);
            break;
          case "delete-footer":
            await comments.deleteFooter(args, flags);
            break;
          case "list-inline":
            await comments.listInline(args, flags);
            break;
          case "get-inline":
            await comments.getInline(args, flags);
            break;
          case "create-inline":
            await comments.createInline(args, flags);
            break;
          case "update-inline":
            await comments.updateInline(args, flags);
            break;
          case "delete-inline":
            await comments.deleteInline(args, flags);
            break;
          case "list-by-page":
            await comments.listByPage(args, flags);
            break;
          default:
            throw new Error(
              `Unknown action "${action}" for resource "comments"`,
            );
        }
        break;
      }

      case "users": {
        switch (action) {
          case "bulk-lookup":
            await users.bulkLookup(args, flags);
            break;
          case "check-access":
            await users.checkAccess(args, flags);
            break;
          case "invite":
            await users.invite(args, flags);
            break;
          default:
            throw new Error(`Unknown action "${action}" for resource "users"`);
        }
        break;
      }

      case "search": {
        switch (action) {
          case "cql":
            await search.cql(args, flags);
            break;
          default:
            throw new Error(`Unknown action "${action}" for resource "search"`);
        }
        break;
      }

      default:
        throw new Error(`Unknown resource "${resource}"`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
}

main();
