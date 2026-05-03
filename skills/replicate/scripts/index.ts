/**
 * Replicate API CLI
 *
 * A Bun-based TypeScript CLI for the Replicate HTTP API.
 * All stdout output is valid JSON. Errors are written as JSON to stdout
 * with process.exit(1). Info/debug messages go to stderr.
 *
 * Usage:
 *   bun run scripts/index.ts <resource> <action> [positional_args...] [--key=value ...]
 */

/* -------------------------------------------------------------------------- */
/*                                 TYPES                                      */
/* -------------------------------------------------------------------------- */

interface PageResponse<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Prediction {
  id: string;
  model: string;
  version: string;
  input: Record<string, unknown>;
  logs: string | null;
  output: unknown;
  error: string | null;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  created_at: string;
  source: "api" | "web";
  data_removed: boolean;
  started_at: string | null;
  completed_at: string | null;
  metrics: { predict_time?: number; total_time?: number } | null;
  urls: {
    get: string;
    cancel: string;
    stream?: string;
    web?: string;
  };
}

interface Model {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  github_url: string | null;
  paper_url: string | null;
  license_url: string | null;
  run_count: number;
  cover_image_url: string | null;
  default_example: Prediction | null;
  latest_version: ModelVersion | null;
}

interface ModelVersion {
  id: string;
  created_at: string;
  cog_version: string;
  openapi_schema: Record<string, unknown>;
}

interface Collection {
  name: string;
  slug: string;
  description: string;
  full_description?: string | null;
  models?: Model[];
}

interface Deployment {
  owner: string;
  name: string;
  model: string;
  version: string;
  hardware: string;
  min_instances: number;
  max_instances: number;
}

interface FileObject {
  id: string;
  name: string;
  content_type: string;
  size: number;
  etag: string;
  metadata: Record<string, unknown>;
  created_at: string;
  urls: {
    get: string;
  };
}

interface Hardware {
  sku: string;
  name: string;
}

interface Training extends Prediction {
  destination: string;
  version: string;
}

interface Account {
  type: string;
  username: string;
  name: string;
  github_url: string | null;
}

interface WebhookSecret {
  key: string;
}

/* -------------------------------------------------------------------------- */
/*                                 ERRORS                                     */
/* -------------------------------------------------------------------------- */

/**
 * Custom error class for Replicate API errors.
 * Includes an HTTP status code when available.
 */
class ReplicateError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "ReplicateError";
    this.statusCode = statusCode;
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CLIENT                                     */
/* -------------------------------------------------------------------------- */

/**
 * Low-level HTTP client for the Replicate API.
 * Handles authentication, base URL, headers, and response parsing.
 */
class ReplicateClient {
  private baseUrl = "https://api.replicate.com/v1";
  private token: string;

  constructor() {
    const token = process.env.REPLICATE_API_TOKEN?.trim();
    if (!token) {
      throw new ReplicateError(
        "REPLICATE_API_TOKEN environment variable is required. Set it with: export REPLICATE_API_TOKEN=<your_token>",
        401,
      );
    }
    this.token = token;
  }

  /**
   * Build a full URL from a path and optional query params.
   */
  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, v);
        }
      }
    }
    return url.toString();
  }

  /**
   * Perform an HTTP request.
   */
  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string>;
      headers?: Record<string, string>;
      contentType?: string;
    } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...options.headers,
    };

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        body = options.body;
      } else if (typeof options.body === "string") {
        headers["Content-Type"] = options.contentType || "text/plain";
        body = options.body;
      } else {
        headers["Content-Type"] = options.contentType || "application/json";
        body = JSON.stringify(options.body);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ReplicateError(`Network error: ${msg}`, 0);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const detail =
        typeof data === "object" && data !== null && "detail" in data
          ? (data as Record<string, unknown>).detail
          : text;
      throw new ReplicateError(
        `Replicate API error (${response.status}): ${detail || response.statusText}`,
        response.status,
      );
    }

    return data as T;
  }
}

/* -------------------------------------------------------------------------- */
/*                              RESOURCES                                     */
/* -------------------------------------------------------------------------- */

/**
 * Manage predictions (model runs).
 */
class PredictionsResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List predictions with optional filters.
   */
  async list(query?: {
    created_after?: string;
    created_before?: string;
    source?: string;
  }): Promise<PageResponse<Prediction>> {
    return this.client.request("GET", "/predictions", { query });
  }

  /**
   * Create a new prediction.
   *
   * @param version - Model identifier: owner/name, owner/name:version_id, or version_id
   * @param input - Model input JSON object
   * @param options - Optional webhook, webhook_events_filter, Prefer, Cancel-After
   */
  async create(
    version: string,
    input: Record<string, unknown>,
    options: {
      webhook?: string;
      webhook_events_filter?: string[];
      prefer?: string;
      cancel_after?: string;
    } = {},
  ): Promise<Prediction> {
    const body: Record<string, unknown> = { version, input };
    if (options.webhook) body.webhook = options.webhook;
    if (options.webhook_events_filter) {
      body.webhook_events_filter = options.webhook_events_filter;
    }

    const headers: Record<string, string> = {};
    if (options.prefer) headers["Prefer"] = options.prefer;
    if (options.cancel_after) headers["Cancel-After"] = options.cancel_after;

    return this.client.request("POST", "/predictions", { body, headers });
  }

  /**
   * Get a single prediction by ID.
   */
  async get(predictionId: string): Promise<Prediction> {
    return this.client.request("GET", `/predictions/${predictionId}`);
  }

  /**
   * Cancel a running prediction.
   */
  async cancel(predictionId: string): Promise<Prediction> {
    return this.client.request("POST", `/predictions/${predictionId}/cancel`);
  }
}

/**
 * Manage models.
 */
class ModelsResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List public models.
   */
  async list(query?: {
    sort_by?: string;
    sort_direction?: string;
  }): Promise<PageResponse<Model>> {
    return this.client.request("GET", "/models", { query });
  }

  /**
   * Search public models with a text query (uses QUERY method).
   */
  async search(query: string): Promise<PageResponse<Model>> {
    return this.client.request("QUERY", "/models", {
      body: query,
      contentType: "text/plain",
    });
  }

  /**
   * Get a model by owner and name.
   */
  async get(owner: string, name: string): Promise<Model> {
    return this.client.request("GET", `/models/${owner}/${name}`);
  }

  /**
   * Create a new model.
   */
  async create(body: {
    owner: string;
    name: string;
    visibility: "public" | "private";
    hardware: string;
    description?: string;
    cover_image_url?: string;
    github_url?: string;
    license_url?: string;
    paper_url?: string;
  }): Promise<Model> {
    return this.client.request("POST", "/models", { body });
  }

  /**
   * Update model metadata.
   */
  async update(
    owner: string,
    name: string,
    body: {
      description?: string;
      readme?: string;
      github_url?: string;
      paper_url?: string;
      weights_url?: string;
      license_url?: string;
    },
  ): Promise<Model> {
    return this.client.request("PATCH", `/models/${owner}/${name}`, { body });
  }

  /**
   * Delete a model.
   */
  async delete(owner: string, name: string): Promise<void> {
    return this.client.request("DELETE", `/models/${owner}/${name}`);
  }

  /**
   * List example predictions for a model.
   */
  async examples(
    owner: string,
    name: string,
  ): Promise<PageResponse<Prediction>> {
    return this.client.request("GET", `/models/${owner}/${name}/examples`);
  }

  /**
   * Create a prediction using an official model.
   */
  async predictionsCreate(
    owner: string,
    name: string,
    input: Record<string, unknown>,
    options: {
      webhook?: string;
      webhook_events_filter?: string[];
      prefer?: string;
      cancel_after?: string;
    } = {},
  ): Promise<Prediction> {
    const body: Record<string, unknown> = { input };
    if (options.webhook) body.webhook = options.webhook;
    if (options.webhook_events_filter) {
      body.webhook_events_filter = options.webhook_events_filter;
    }

    const headers: Record<string, string> = {};
    if (options.prefer) headers["Prefer"] = options.prefer;
    if (options.cancel_after) headers["Cancel-After"] = options.cancel_after;

    return this.client.request("POST", `/models/${owner}/${name}/predictions`, {
      body,
      headers,
    });
  }

  /**
   * Get a model's README content.
   */
  async readme(owner: string, name: string): Promise<string> {
    return this.client.request("GET", `/models/${owner}/${name}/readme`);
  }

  /**
   * List versions for a model.
   */
  async versions(
    owner: string,
    name: string,
  ): Promise<PageResponse<ModelVersion>> {
    return this.client.request("GET", `/models/${owner}/${name}/versions`);
  }

  /**
   * Get a specific model version.
   */
  async versionGet(
    owner: string,
    name: string,
    versionId: string,
  ): Promise<ModelVersion> {
    return this.client.request(
      "GET",
      `/models/${owner}/${name}/versions/${versionId}`,
    );
  }

  /**
   * Delete a model version.
   */
  async versionDelete(
    owner: string,
    name: string,
    versionId: string,
  ): Promise<void> {
    return this.client.request(
      "DELETE",
      `/models/${owner}/${name}/versions/${versionId}`,
    );
  }

  /**
   * Create a training on a model version.
   */
  async trainingsCreate(
    owner: string,
    name: string,
    versionId: string,
    body: {
      destination: string;
      input: Record<string, unknown>;
      webhook?: string;
      webhook_events_filter?: string[];
    },
  ): Promise<Training> {
    return this.client.request(
      "POST",
      `/models/${owner}/${name}/versions/${versionId}/trainings`,
      { body },
    );
  }
}

/**
 * Manage collections of models.
 */
class CollectionsResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List all collections.
   */
  async list(): Promise<PageResponse<Collection>> {
    return this.client.request("GET", "/collections");
  }

  /**
   * Get a collection by slug.
   */
  async get(slug: string): Promise<Collection> {
    return this.client.request("GET", `/collections/${slug}`);
  }
}

/**
 * Manage deployments.
 */
class DeploymentsResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List deployments.
   */
  async list(): Promise<PageResponse<Deployment>> {
    return this.client.request("GET", "/deployments");
  }

  /**
   * Create a deployment.
   */
  async create(body: {
    name: string;
    model: string;
    version: string;
    hardware: string;
    min_instances: number;
    max_instances: number;
  }): Promise<Deployment> {
    return this.client.request("POST", "/deployments", { body });
  }

  /**
   * Get a deployment.
   */
  async get(owner: string, name: string): Promise<Deployment> {
    return this.client.request("GET", `/deployments/${owner}/${name}`);
  }

  /**
   * Update a deployment.
   */
  async update(
    owner: string,
    name: string,
    body: {
      hardware?: string;
      min_instances?: number;
      max_instances?: number;
      version?: string;
    },
  ): Promise<Deployment> {
    return this.client.request("PATCH", `/deployments/${owner}/${name}`, {
      body,
    });
  }

  /**
   * Delete a deployment.
   */
  async delete(owner: string, name: string): Promise<void> {
    return this.client.request("DELETE", `/deployments/${owner}/${name}`);
  }

  /**
   * Create a prediction using a deployment.
   */
  async predictionsCreate(
    owner: string,
    name: string,
    input: Record<string, unknown>,
    options: {
      webhook?: string;
      webhook_events_filter?: string[];
      prefer?: string;
      cancel_after?: string;
    } = {},
  ): Promise<Prediction> {
    const body: Record<string, unknown> = { input };
    if (options.webhook) body.webhook = options.webhook;
    if (options.webhook_events_filter) {
      body.webhook_events_filter = options.webhook_events_filter;
    }

    const headers: Record<string, string> = {};
    if (options.prefer) headers["Prefer"] = options.prefer;
    if (options.cancel_after) headers["Cancel-After"] = options.cancel_after;

    return this.client.request(
      "POST",
      `/deployments/${owner}/${name}/predictions`,
      { body, headers },
    );
  }
}

/**
 * Manage uploaded files.
 */
class FilesResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List uploaded files.
   */
  async list(): Promise<PageResponse<FileObject>> {
    return this.client.request("GET", "/files");
  }

  /**
   * Upload a new file.
   */
  async create(
    filePath: string,
    options: {
      filename?: string;
      type?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<FileObject> {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      throw new ReplicateError(`File not found: ${filePath}`, 400);
    }

    const form = new FormData();
    form.append("content", file);
    if (options.filename) form.append("filename", options.filename);
    if (options.type) form.append("type", options.type);
    if (options.metadata)
      form.append("metadata", JSON.stringify(options.metadata));

    return this.client.request("POST", "/files", { body: form });
  }

  /**
   * Get a file metadata.
   */
  async get(fileId: string): Promise<FileObject> {
    return this.client.request("GET", `/files/${fileId}`);
  }

  /**
   * Delete a file.
   */
  async delete(fileId: string): Promise<void> {
    return this.client.request("DELETE", `/files/${fileId}`);
  }

  /**
   * Get a signed download URL for a file.
   */
  async download(
    fileId: string,
    query: { owner: string; expiry: string; signature: string },
  ): Promise<{ url: string }> {
    return this.client.request("GET", `/files/${fileId}/download`, { query });
  }
}

/**
 * List available hardware SKUs.
 */
class HardwareResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List available hardware for running models.
   */
  async list(): Promise<PageResponse<Hardware>> {
    return this.client.request("GET", "/hardware");
  }
}

/**
 * Manage trainings.
 */
class TrainingsResource {
  constructor(private client: ReplicateClient) {}

  /**
   * List trainings.
   */
  async list(): Promise<PageResponse<Training>> {
    return this.client.request("GET", "/trainings");
  }

  /**
   * Get a training by ID.
   */
  async get(trainingId: string): Promise<Training> {
    return this.client.request("GET", `/trainings/${trainingId}`);
  }

  /**
   * Cancel a training.
   */
  async cancel(trainingId: string): Promise<Training> {
    return this.client.request("POST", `/trainings/${trainingId}/cancel`);
  }
}

/**
 * Account information.
 */
class AccountResource {
  constructor(private client: ReplicateClient) {}

  /**
   * Get the authenticated account.
   */
  async get(): Promise<Account> {
    return this.client.request("GET", "/account");
  }
}

/**
 * Webhooks.
 */
class WebhooksResource {
  constructor(private client: ReplicateClient) {}

  /**
   * Get the signing secret for the default webhook.
   */
  async defaultSecretGet(): Promise<WebhookSecret> {
    return this.client.request("GET", "/webhooks/default/secret");
  }
}

/**
 * Search models, collections, and docs.
 */
class SearchResource {
  constructor(private client: ReplicateClient) {}

  /**
   * Search for public models, collections, and docs.
   */
  async search(query: string, limit?: string): Promise<unknown> {
    return this.client.request("GET", "/search", {
      query: { query, ...(limit ? { limit } : {}) },
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                                 CLI                                        */
/* -------------------------------------------------------------------------- */

interface ParsedArgs {
  positional: string[];
  options: Record<string, string>;
}

/**
 * Parse command-line arguments.
 * Positional args are plain values.
 * Options are `--key=value` or `--key value`.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const eqIndex = key.indexOf("=");
      if (eqIndex !== -1) {
        options[key.slice(0, eqIndex)] = key.slice(eqIndex + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        options[key] = argv[i + 1];
        i += 1;
      } else {
        options[key] = "true";
      }
    } else {
      positional.push(arg);
    }
    i += 1;
  }

  return { positional, options };
}

/**
 * Parse a JSON string argument safely.
 */
function parseJsonArg(arg: string): unknown {
  try {
    return JSON.parse(arg);
  } catch {
    throw new ReplicateError(`Invalid JSON argument: ${arg}`, 400);
  }
}

/**
 * Print usage information.
 */
function printUsage() {
  const usage = `
Replicate API CLI

Usage:
  bun run scripts/index.ts <resource> <action> [args...] [--key=value ...]

Resources and actions:

  predictions
    list                                      List predictions
    create <version> <input_json>             Create a prediction
    get <prediction_id>                       Get a prediction
    cancel <prediction_id>                    Cancel a prediction

  models
    list                                      List public models
    search <query>                            Search models (QUERY method)
    get <owner> <name>                        Get a model
    create <body_json>                        Create a model
    update <owner> <name> <body_json>         Update a model
    delete <owner> <name>                     Delete a model
    examples <owner> <name>                   List model examples
    predictions <owner> <name> <input_json>   Create prediction on official model
    readme <owner> <name>                     Get model README
    versions <owner> <name>                   List model versions
    version <owner> <name> <version_id>       Get a model version
    version-delete <owner> <name> <version_id> Delete a model version
    trainings <owner> <name> <version_id> <body_json> Create a training

  collections
    list                                      List collections
    get <slug>                                Get a collection

  deployments
    list                                      List deployments
    create <body_json>                        Create a deployment
    get <owner> <name>                        Get a deployment
    update <owner> <name> <body_json>         Update a deployment
    delete <owner> <name>                     Delete a deployment
    predictions <owner> <name> <input_json>   Create prediction on deployment

  files
    list                                      List files
    create <file_path>                        Upload a file
    get <file_id>                             Get file metadata
    delete <file_id>                          Delete a file
    download <file_id> --owner=... --expiry=... --signature=...
                                              Get signed download URL

  hardware
    list                                      List hardware SKUs

  trainings
    list                                      List trainings
    get <training_id>                         Get a training
    cancel <training_id>                      Cancel a training

  account
    get                                       Get authenticated account

  webhooks
    default-secret                            Get default webhook secret

  search
    search <query> [--limit=N]                Search models/collections/docs

Options for prediction creation:
  --webhook=<url>
  --webhook-events-filter=<json_array>
  --prefer=<wait=N>
  --cancel-after=<duration>
`;
  console.error(usage.trim());
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item, index) => `${index + 1}. ${formatValue(item)}`)
      .join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, val]) => `- **${key}:** ${formatValue(val)}`)
      .join("\n");
  }
  return String(value);
}

/**
 * Format a result as Markdown or plain text.
 * Simple values get plain text. Complex objects get Markdown.
 */
function formatResult(result: unknown): string {
  if (result === null || result === undefined) {
    return "Operation completed successfully.";
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "boolean" || typeof result === "number") {
    return String(result);
  }

  // For objects with 'results' (paginated responses)
  if (typeof result === "object" && result !== null && "results" in result) {
    const pageResult = result as PageResponse<unknown>;
    let output = "# Result\n\n";

    if (pageResult.next || pageResult.previous) {
      output += "## Pagination\n";
      if (pageResult.next) output += `- **Next page:** ${pageResult.next}\n`;
      if (pageResult.previous)
        output += `- **Previous page:** ${pageResult.previous}\n`;
      output += "\n";
    }

    const results = pageResult.results;
    if (Array.isArray(results)) {
      output += `## Results (${results.length} items)\n\n`;
      results.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          const name =
            (item as Record<string, unknown>).name ||
            (item as Record<string, unknown>).id ||
            `Item ${index + 1}`;
          output += `### ${index + 1}. ${name}\n${formatValue(item)}\n\n`;
        } else {
          output += `${index + 1}. ${formatValue(item)}\n`;
        }
      });
    }

    return output.trim();
  }

  // For single objects
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    // Special formatting for predictions
    if ("status" in obj && "id" in obj) {
      let output = "# Prediction Result\n\n";
      output += `- **ID:** ${obj.id}\n`;
      output += `- **Status:** ${obj.status}\n`;
      if (obj.model) output += `- **Model:** ${obj.model}\n`;
      if (obj.version) output += `- **Version:** ${obj.version}\n`;
      if (obj.created_at) output += `- **Created:** ${obj.created_at}\n`;
      if (obj.started_at) output += `- **Started:** ${obj.started_at}\n`;
      if (obj.completed_at) output += `- **Completed:** ${obj.completed_at}\n`;

      if (obj.error) {
        output += `\n## Error\n\n${obj.error}\n`;
      }

      if (obj.output !== undefined && obj.output !== null) {
        output += `\n## Output\n\n${formatValue(obj.output)}\n`;
      }

      if (obj.logs) {
        output += `\n## Logs\n\n\`\`\`\n${obj.logs}\n\`\`\`\n`;
      }

      if (obj.urls) {
        output += `\n## URLs\n\n${formatValue(obj.urls)}\n`;
      }

      return output.trim();
    }

    // Special formatting for files
    if ("content_type" in obj && "urls" in obj) {
      let output = "# File Result\n\n";
      output += `- **ID:** ${obj.id}\n`;
      output += `- **Name:** ${obj.name}\n`;
      output += `- **Type:** ${obj.content_type}\n`;
      output += `- **Size:** ${obj.size} bytes\n`;
      output += `- **Created:** ${obj.created_at}\n`;
      if (obj.urls) {
        const urls = obj.urls as Record<string, string>;
        output += `- **URL:** ${urls.get}\n`;
      }
      return output.trim();
    }

    // Generic object formatting
    return `# Result\n\n${formatValue(result)}`;
  }

  return String(result);
}

/**
 * Format an error message as plain text.
 */
function formatError(message: string, statusCode: number): string {
  if (message.startsWith("Usage:")) {
    return `Error: ${message} (Status: ${statusCode})`;
  }
  return `Error: ${message} (Status: ${statusCode})`;
}

/**
 * Main CLI router.
 */
async function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    printUsage();
    console.log("Error: Missing resource and action arguments (Status: 400)");
    process.exit(1);
  }

  const [resource, action, ...rest] = argv;
  const { positional, options } = parseArgs(rest);

  let client: ReplicateClient;
  try {
    client = new ReplicateClient();
  } catch (err) {
    if (err instanceof ReplicateError) {
      console.log(formatError(err.message, err.statusCode));
    } else {
      console.log(`Error: ${String(err)} (Status: 500)`);
    }
    process.exit(1);
  }

  let result: unknown;

  try {
    switch (resource) {
      case "predictions": {
        const predictions = new PredictionsResource(client);
        switch (action) {
          case "list":
            result = await predictions.list({
              created_after: options["created_after"],
              created_before: options["created_before"],
              source: options["source"],
            });
            break;
          case "create": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: predictions create <version> <input_json> [--webhook=...] [--webhook-events-filter=...] [--prefer=...] [--cancel-after=...]",
                400,
              );
            }
            const version = positional[0];
            const input = parseJsonArg(positional[1]) as Record<
              string,
              unknown
            >;
            const webhookEventsFilter = options["webhook-events-filter"]
              ? (parseJsonArg(options["webhook-events-filter"]) as string[])
              : undefined;
            result = await predictions.create(version, input, {
              webhook: options["webhook"],
              webhook_events_filter: webhookEventsFilter,
              prefer: options["prefer"],
              cancel_after: options["cancel-after"],
            });
            break;
          }
          case "get": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: predictions get <prediction_id>",
                400,
              );
            }
            result = await predictions.get(positional[0]);
            break;
          }
          case "cancel": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: predictions cancel <prediction_id>",
                400,
              );
            }
            result = await predictions.cancel(positional[0]);
            break;
          }
          default:
            throw new ReplicateError(
              `Unknown action: predictions ${action}`,
              400,
            );
        }
        break;
      }

      case "models": {
        const models = new ModelsResource(client);
        switch (action) {
          case "list":
            result = await models.list({
              sort_by: options["sort-by"],
              sort_direction: options["sort-direction"],
            });
            break;
          case "search": {
            if (positional.length < 1) {
              throw new ReplicateError("Usage: models search <query>", 400);
            }
            result = await models.search(positional[0]);
            break;
          }
          case "get": {
            if (positional.length < 2) {
              throw new ReplicateError("Usage: models get <owner> <name>", 400);
            }
            result = await models.get(positional[0], positional[1]);
            break;
          }
          case "create": {
            if (positional.length < 1) {
              throw new ReplicateError("Usage: models create <body_json>", 400);
            }
            result = await models.create(
              parseJsonArg(positional[0]) as Parameters<
                ModelsResource["create"]
              >[0],
            );
            break;
          }
          case "update": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: models update <owner> <name> <body_json>",
                400,
              );
            }
            result = await models.update(
              positional[0],
              positional[1],
              parseJsonArg(positional[2]) as Parameters<
                ModelsResource["update"]
              >[1],
            );
            break;
          }
          case "delete": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: models delete <owner> <name>",
                400,
              );
            }
            result = await models.delete(positional[0], positional[1]);
            break;
          }
          case "examples": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: models examples <owner> <name>",
                400,
              );
            }
            result = await models.examples(positional[0], positional[1]);
            break;
          }
          case "predictions": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: models predictions <owner> <name> <input_json> [--webhook=...] [--webhook-events-filter=...] [--prefer=...] [--cancel-after=...]",
                400,
              );
            }
            const input = parseJsonArg(positional[2]) as Record<
              string,
              unknown
            >;
            const webhookEventsFilter = options["webhook-events-filter"]
              ? (parseJsonArg(options["webhook-events-filter"]) as string[])
              : undefined;
            result = await models.predictionsCreate(
              positional[0],
              positional[1],
              input,
              {
                webhook: options["webhook"],
                webhook_events_filter: webhookEventsFilter,
                prefer: options["prefer"],
                cancel_after: options["cancel-after"],
              },
            );
            break;
          }
          case "readme": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: models readme <owner> <name>",
                400,
              );
            }
            result = await models.readme(positional[0], positional[1]);
            break;
          }
          case "versions": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: models versions <owner> <name>",
                400,
              );
            }
            result = await models.versions(positional[0], positional[1]);
            break;
          }
          case "version": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: models version <owner> <name> <version_id>",
                400,
              );
            }
            result = await models.versionGet(
              positional[0],
              positional[1],
              positional[2],
            );
            break;
          }
          case "version-delete": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: models version-delete <owner> <name> <version_id>",
                400,
              );
            }
            result = await models.versionDelete(
              positional[0],
              positional[1],
              positional[2],
            );
            break;
          }
          case "trainings": {
            if (positional.length < 4) {
              throw new ReplicateError(
                "Usage: models trainings <owner> <name> <version_id> <body_json>",
                400,
              );
            }
            result = await models.trainingsCreate(
              positional[0],
              positional[1],
              positional[2],
              parseJsonArg(positional[3]) as Parameters<
                ModelsResource["trainingsCreate"]
              >[3],
            );
            break;
          }
          default:
            throw new ReplicateError(`Unknown action: models ${action}`, 400);
        }
        break;
      }

      case "collections": {
        const collections = new CollectionsResource(client);
        switch (action) {
          case "list":
            result = await collections.list();
            break;
          case "get": {
            if (positional.length < 1) {
              throw new ReplicateError("Usage: collections get <slug>", 400);
            }
            result = await collections.get(positional[0]);
            break;
          }
          default:
            throw new ReplicateError(
              `Unknown action: collections ${action}`,
              400,
            );
        }
        break;
      }

      case "deployments": {
        const deployments = new DeploymentsResource(client);
        switch (action) {
          case "list":
            result = await deployments.list();
            break;
          case "create": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: deployments create <body_json>",
                400,
              );
            }
            result = await deployments.create(
              parseJsonArg(positional[0]) as Parameters<
                DeploymentsResource["create"]
              >[0],
            );
            break;
          }
          case "get": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: deployments get <owner> <name>",
                400,
              );
            }
            result = await deployments.get(positional[0], positional[1]);
            break;
          }
          case "update": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: deployments update <owner> <name> <body_json>",
                400,
              );
            }
            result = await deployments.update(
              positional[0],
              positional[1],
              parseJsonArg(positional[2]) as Parameters<
                DeploymentsResource["update"]
              >[1],
            );
            break;
          }
          case "delete": {
            if (positional.length < 2) {
              throw new ReplicateError(
                "Usage: deployments delete <owner> <name>",
                400,
              );
            }
            result = await deployments.delete(positional[0], positional[1]);
            break;
          }
          case "predictions": {
            if (positional.length < 3) {
              throw new ReplicateError(
                "Usage: deployments predictions <owner> <name> <input_json> [--webhook=...] [--webhook-events-filter=...] [--prefer=...] [--cancel-after=...]",
                400,
              );
            }
            const input = parseJsonArg(positional[2]) as Record<
              string,
              unknown
            >;
            const webhookEventsFilter = options["webhook-events-filter"]
              ? (parseJsonArg(options["webhook-events-filter"]) as string[])
              : undefined;
            result = await deployments.predictionsCreate(
              positional[0],
              positional[1],
              input,
              {
                webhook: options["webhook"],
                webhook_events_filter: webhookEventsFilter,
                prefer: options["prefer"],
                cancel_after: options["cancel-after"],
              },
            );
            break;
          }
          default:
            throw new ReplicateError(
              `Unknown action: deployments ${action}`,
              400,
            );
        }
        break;
      }

      case "files": {
        const files = new FilesResource(client);
        switch (action) {
          case "list":
            result = await files.list();
            break;
          case "create": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: files create <file_path> [--filename=...] [--type=...]",
                400,
              );
            }
            const metadata = options["metadata"]
              ? (parseJsonArg(options["metadata"]) as Record<string, unknown>)
              : undefined;
            result = await files.create(positional[0], {
              filename: options["filename"],
              type: options["type"],
              metadata,
            });
            break;
          }
          case "get": {
            if (positional.length < 1) {
              throw new ReplicateError("Usage: files get <file_id>", 400);
            }
            result = await files.get(positional[0]);
            break;
          }
          case "delete": {
            if (positional.length < 1) {
              throw new ReplicateError("Usage: files delete <file_id>", 400);
            }
            result = await files.delete(positional[0]);
            break;
          }
          case "download": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: files download <file_id> --owner=... --expiry=... --signature=...",
                400,
              );
            }
            result = await files.download(positional[0], {
              owner: options["owner"] || "",
              expiry: options["expiry"] || "",
              signature: options["signature"] || "",
            });
            break;
          }
          default:
            throw new ReplicateError(`Unknown action: files ${action}`, 400);
        }
        break;
      }

      case "hardware": {
        const hardware = new HardwareResource(client);
        switch (action) {
          case "list":
            result = await hardware.list();
            break;
          default:
            throw new ReplicateError(`Unknown action: hardware ${action}`, 400);
        }
        break;
      }

      case "trainings": {
        const trainings = new TrainingsResource(client);
        switch (action) {
          case "list":
            result = await trainings.list();
            break;
          case "get": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: trainings get <training_id>",
                400,
              );
            }
            result = await trainings.get(positional[0]);
            break;
          }
          case "cancel": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: trainings cancel <training_id>",
                400,
              );
            }
            result = await trainings.cancel(positional[0]);
            break;
          }
          default:
            throw new ReplicateError(
              `Unknown action: trainings ${action}`,
              400,
            );
        }
        break;
      }

      case "account": {
        const account = new AccountResource(client);
        switch (action) {
          case "get":
            result = await account.get();
            break;
          default:
            throw new ReplicateError(`Unknown action: account ${action}`, 400);
        }
        break;
      }

      case "webhooks": {
        const webhooks = new WebhooksResource(client);
        switch (action) {
          case "default-secret":
            result = await webhooks.defaultSecretGet();
            break;
          default:
            throw new ReplicateError(`Unknown action: webhooks ${action}`, 400);
        }
        break;
      }

      case "search": {
        const search = new SearchResource(client);
        switch (action) {
          case "search": {
            if (positional.length < 1) {
              throw new ReplicateError(
                "Usage: search search <query> [--limit=N]",
                400,
              );
            }
            result = await search.search(positional[0], options["limit"]);
            break;
          }
          default:
            throw new ReplicateError(`Unknown action: search ${action}`, 400);
        }
        break;
      }

      default:
        throw new ReplicateError(`Unknown resource: ${resource}`, 400);
    }
  } catch (err) {
    if (err instanceof ReplicateError) {
      console.log(formatError(err.message, err.statusCode));
    } else {
      console.log(`Error: ${String(err)} (Status: 500)`);
    }
    process.exit(1);
  }

  console.log(formatResult(result));
}

main();
