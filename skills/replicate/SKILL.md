---
name: replicate
description: Run AI models on Replicate for generating images, videos, editing images, upscaling, and fine-tuning. Activate when the user asks to generate an image, generate a video, edit an image, upscale a photo, run an AI model in the cloud, fine-tune a model, create a prediction, search for AI models, or work with Replicate operations like deployments, files, trainings, and model versions.
---

# Replicate Skill

Interact with the [Replicate](https://replicate.com) platform via its HTTP API using a Bun TypeScript CLI.

## What is Replicate?

Replicate is a cloud platform for running machine learning models. You can generate images, videos, audio, and text using open-source models without managing infrastructure. Models run on-demand with GPU hardware.

## Requirements

- **Bun** runtime (see Installation section below)
- **REPLICATE_API_TOKEN** environment variable (get yours at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens))

## Setup

```bash
export REPLICATE_API_TOKEN="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Never hardcode the token. Always use environment variables.

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
bun run skills/replicate/scripts/index.ts <resource> <action> [args...] [--key=value ...]
```

All output is valid JSON on stdout. Errors are JSON objects with an `error` field. Debug/info goes to stderr.

## Command Reference

### predictions

**`list`** — List predictions with optional date and source filters.

```bash
bun run skills/replicate/scripts/index.ts predictions list [--created_after=ISO] [--created_before=ISO] [--source=web]
```

**`create`** — Create a prediction for any model version. Returns immediately; poll with `get`.

```bash
bun run skills/replicate/scripts/index.ts predictions create <version> <input_json> [--webhook=URL] [--webhook-events-filter=JSON_ARRAY] [--prefer=wait=N] [--cancel-after=DURATION]
```

**`get`** — Get a prediction by ID. Use this for polling until completion.

```bash
bun run skills/replicate/scripts/index.ts predictions get <prediction_id>
```

**`cancel`** — Cancel a running or starting prediction.

```bash
bun run skills/replicate/scripts/index.ts predictions cancel <prediction_id>
```

### models

**`list`** — List public models with optional sorting.

```bash
bun run skills/replicate/scripts/index.ts models list [--sort-by=FIELD] [--sort-direction=asc|desc]
```

**`search`** — Search public models using the QUERY method.

```bash
bun run skills/replicate/scripts/index.ts models search <query>
```

**`get`** — Get metadata for a specific model.

```bash
bun run skills/replicate/scripts/index.ts models get <owner> <name>
```

**`create`** — Create a new model.

```bash
bun run skills/replicate/scripts/index.ts models create <body_json>
```

**`update`** — Update metadata for an existing model.

```bash
bun run skills/replicate/scripts/index.ts models update <owner> <name> <body_json>
```

**`delete`** — Delete a private model.

```bash
bun run skills/replicate/scripts/index.ts models delete <owner> <name>
```

**`examples`** — List example predictions for a model.

```bash
bun run skills/replicate/scripts/index.ts models examples <owner> <name>
```

**`predictions`** — Create a prediction using an official model (no version ID required).

```bash
bun run skills/replicate/scripts/index.ts models predictions <owner> <name> <input_json> [--webhook=URL] [--webhook-events-filter=JSON_ARRAY] [--prefer=wait=N] [--cancel-after=DURATION]
```

**`readme`** — Get the README content for a model.

```bash
bun run skills/replicate/scripts/index.ts models readme <owner> <name>
```

**`versions`** — List all versions of a model.

```bash
bun run skills/replicate/scripts/index.ts models versions <owner> <name>
```

**`version`** — Get a specific model version, including its OpenAPI schema.

```bash
bun run skills/replicate/scripts/index.ts models version <owner> <name> <version_id>
```

**`version-delete`** — Delete a model version.

```bash
bun run skills/replicate/scripts/index.ts models version-delete <owner> <name> <version_id>
```

**`trainings`** — Create a training (fine-tuning) on a model version.

```bash
bun run skills/replicate/scripts/index.ts models trainings <owner> <name> <version_id> <body_json>
```

### collections

**`list`** — List all curated collections of models.

```bash
bun run skills/replicate/scripts/index.ts collections list
```

**`get`** — Get a collection by slug.

```bash
bun run skills/replicate/scripts/index.ts collections get <slug>
```

### deployments

**`list`** — List all deployments.

```bash
bun run skills/replicate/scripts/index.ts deployments list
```

**`create`** — Create a new deployment.

```bash
bun run skills/replicate/scripts/index.ts deployments create <body_json>
```

**`get`** — Get a specific deployment.

```bash
bun run skills/replicate/scripts/index.ts deployments get <owner> <name>
```

**`update`** — Update a deployment's configuration.

```bash
bun run skills/replicate/scripts/index.ts deployments update <owner> <name> <body_json>
```

**`delete`** — Delete a deployment.

```bash
bun run skills/replicate/scripts/index.ts deployments delete <owner> <name>
```

**`predictions`** — Create a prediction using a deployment.

```bash
bun run skills/replicate/scripts/index.ts deployments predictions <owner> <name> <input_json> [--webhook=URL] [--webhook-events-filter=JSON_ARRAY] [--prefer=wait=N] [--cancel-after=DURATION]
```

### files

**`list`** — List all uploaded files.

```bash
bun run skills/replicate/scripts/index.ts files list
```

**`create`** — Upload a file (image, video, etc.). Returns a Replicate-hosted URL.

```bash
bun run skills/replicate/scripts/index.ts files create <file_path> [--filename=NAME] [--type=MIME]
```

**`get`** — Get metadata for a file.

```bash
bun run skills/replicate/scripts/index.ts files get <file_id>
```

**`delete`** — Delete a file.

```bash
bun run skills/replicate/scripts/index.ts files delete <file_id>
```

**`download`** — Get a signed download URL for a file.

```bash
bun run skills/replicate/scripts/index.ts files download <file_id> --owner=... --expiry=... --signature=...
```

### hardware

**`list`** — List available hardware SKUs for running models.

```bash
bun run skills/replicate/scripts/index.ts hardware list
```

### trainings

**`list`** — List all trainings.

```bash
bun run skills/replicate/scripts/index.ts trainings list
```

**`get`** — Get a training by ID.

```bash
bun run skills/replicate/scripts/index.ts trainings get <training_id>
```

**`cancel`** — Cancel a running training.

```bash
bun run skills/replicate/scripts/index.ts trainings cancel <training_id>
```

### account

**`get`** — Get information about the authenticated account.

```bash
bun run skills/replicate/scripts/index.ts account get
```

### webhooks

**`default-secret`** — Get the signing secret for the default webhook.

```bash
bun run skills/replicate/scripts/index.ts webhooks default-secret
```

### search

**`search`** — Search models, collections, and docs.

```bash
bun run skills/replicate/scripts/index.ts search search <query> [--limit=N]
```

## Examples by Resource

### predictions

**List predictions from the last 24 hours:**

```bash
bun run skills/replicate/scripts/index.ts predictions list --created_after="2025-05-02T00:00:00Z"
```

**Generate an image with Flux Schnell:**

```bash
bun run skills/replicate/scripts/index.ts predictions create \
  "black-forest-labs/flux-schnell" \
  '{"prompt":"an astronaut riding a horse on mars"}'
```

**Generate with sync mode (wait up to 60s):**

```bash
bun run skills/replicate/scripts/index.ts predictions create \
  "black-forest-labs/flux-schnell" \
  '{"prompt":"a cat wearing a wizard hat"}' \
  --prefer="wait=60"
```

**Poll a prediction until completion:**

```bash
bun run skills/replicate/scripts/index.ts predictions get gm3qorzdhgbfurvjtvhg6dckhu
```

**Cancel a long-running prediction:**

```bash
bun run skills/replicate/scripts/index.ts predictions cancel gm3qorzdhgbfurvjtvhg6dckhu
```

### models

**List the most recently updated public models:**

```bash
bun run skills/replicate/scripts/index.ts models list
```

**Search for image editing models:**

```bash
bun run skills/replicate/scripts/index.ts models search "image editing"
```

**Get metadata for a specific model:**

```bash
bun run skills/replicate/scripts/index.ts models get black-forest-labs flux-schnell
```

**Create a new private model:**

```bash
bun run skills/replicate/scripts/index.ts models create \
  '{"owner":"your-username","name":"my-model","visibility":"private","hardware":"cpu","description":"My custom model"}'
```

**Update a model's README:**

```bash
bun run skills/replicate/scripts/index.ts models update \
  your-username my-model \
  '{"readme":"# My Model\\n\\nThis model does..."}'
```

**Delete a private model:**

```bash
bun run skills/replicate/scripts/index.ts models delete your-username my-model
```

**View example predictions for a model:**

```bash
bun run skills/replicate/scripts/index.ts models examples black-forest-labs flux-schnell
```

**Run an official model directly:**

```bash
bun run skills/replicate/scripts/index.ts models predictions \
  stability-ai sdxl \
  '{"prompt":"a red apple on a wooden table"}'
```

**Get a model's README:**

```bash
bun run skills/replicate/scripts/index.ts models readme black-forest-labs flux-schnell
```

**List all versions of a model:**

```bash
bun run skills/replicate/scripts/index.ts models versions black-forest-labs flux-schnell
```

**Get a specific version's schema:**

```bash
bun run skills/replicate/scripts/index.ts models version \
  black-forest-labs flux-schnell \
  "f2abef78e0624f1691c4b05f46798a24c1239b5c"
```

**Delete a model version:**

```bash
bun run skills/replicate/scripts/index.ts models version-delete \
  your-username my-model \
  "f2abef78e0624f1691c4b05f46798a24c1239b5c"
```

**Create a fine-tuning training:**

```bash
bun run skills/replicate/scripts/index.ts models trainings \
  black-forest-labs flux-schnell \
  "f2abef78e0624f1691c4b05f46798a24c1239b5c" \
  '{"destination":"your-username/my-flux-lora","input":{"instance_prompt":"photo of sks person","class_prompt":"photo of a person","instance_data":"https://replicate.delivery/.../training-images.zip"}}'
```

### collections

**List all collections:**

```bash
bun run skills/replicate/scripts/index.ts collections list
```

**Get the super-resolution collection:**

```bash
bun run skills/replicate/scripts/index.ts collections get super-resolution
```

### deployments

**List all deployments:**

```bash
bun run skills/replicate/scripts/index.ts deployments list
```

**Create an always-on deployment:**

```bash
bun run skills/replicate/scripts/index.ts deployments create \
  '{"name":"my-sdxl","model":"stability-ai/sdxl","version":"f2abef78e0624f1691c4b05f46798a24c1239b5c","hardware":"gpu-t4","min_instances":1,"max_instances":3}'
```

**Get deployment status:**

```bash
bun run skills/replicate/scripts/index.ts deployments get your-username my-sdxl
```

**Update deployment hardware:**

```bash
bun run skills/replicate/scripts/index.ts deployments update \
  your-username my-sdxl \
  '{"hardware":"gpu-a100","max_instances":5}'
```

**Delete a deployment:**

```bash
bun run skills/replicate/scripts/index.ts deployments delete your-username my-sdxl
```

**Run a prediction on a deployment:**

```bash
bun run skills/replicate/scripts/index.ts deployments predictions \
  your-username my-sdxl \
  '{"prompt":"a futuristic city at sunset"}'
```

### files

**List uploaded files:**

```bash
bun run skills/replicate/scripts/index.ts files list
```

**Upload an image for editing:**

```bash
bun run skills/replicate/scripts/index.ts files create ./my-photo.png
```

**Get file metadata:**

```bash
bun run skills/replicate/scripts/index.ts files get file_abc123def456
```

**Delete a file:**

```bash
bun run skills/replicate/scripts/index.ts files delete file_abc123def456
```

### hardware

**List available hardware:**

```bash
bun run skills/replicate/scripts/index.ts hardware list
```

### trainings

**List all trainings:**

```bash
bun run skills/replicate/scripts/index.ts trainings list
```

**Get training status:**

```bash
bun run skills/replicate/scripts/index.ts trainings get training_xyz789
```

**Cancel a training:**

```bash
bun run skills/replicate/scripts/index.ts trainings cancel training_xyz789
```

### account

**Get authenticated account:**

```bash
bun run skills/replicate/scripts/index.ts account get
```

### webhooks

**Get default webhook secret:**

```bash
bun run skills/replicate/scripts/index.ts webhooks default-secret
```

### search

**Search with limit:**

```bash
bun run skills/replicate/scripts/index.ts search search "image upscaling" --limit=10
```

## Complete Workflows

### Workflow 1: Generate an Image and Download It

```bash
# 1. Create the prediction
bun run skills/replicate/scripts/index.ts predictions create \
  "black-forest-labs/flux-schnell" \
  '{"prompt":"a cyberpunk cat with neon lights"}'

# 2. Extract the prediction ID from the output and poll until status is "succeeded"
bun run skills/replicate/scripts/index.ts predictions get <prediction_id>

# 3. When status is "succeeded", the output field contains the image URL(s)
# Download the file promptly — URLs expire after 1 hour
```

### Workflow 2: Edit an Existing Image (img2img)

```bash
# 1. Upload the source image
bun run skills/replicate/scripts/index.ts files create ./source-photo.png

# 2. Extract the "urls.get" field from the response (e.g., https://api.replicate.com/v1/files/file_abc123)

# 3. Use that URL as input to an image-to-image model
bun run skills/replicate/scripts/index.ts models predictions \
  tencentarc photomaker \
  '{"prompt":"photo of a person in a suit","input_image":"https://api.replicate.com/v1/files/file_abc123"}'

# 4. Poll the returned prediction ID until completion
bun run skills/replicate/scripts/index.ts predictions get <prediction_id>
```

### Workflow 3: Generate a Video

```bash
# 1. Create the video prediction (video models typically take longer)
bun run skills/replicate/scripts/index.ts predictions create \
  "luma-ai/dream-machine" \
  '{"prompt":"a slow-motion shot of waves crashing on rocks"}'

# 2. Poll more frequently — video generation can take several minutes
bun run skills/replicate/scripts/index.ts predictions get <prediction_id>

# 3. Download the output video URL when status is "succeeded"
```

### Workflow 4: Fine-Tune a Model and Use It

```bash
# 1. Find the base model version you want to fine-tune
bun run skills/replicate/scripts/index.ts models versions black-forest-labs flux-schnell

# 2. Create the training
bun run skills/replicate/scripts/index.ts models trainings \
  black-forest-labs flux-schnell \
  "<version_id>" \
  '{"destination":"your-username/my-lora","input":{"instance_prompt":"photo of sks person","instance_data":"https://your-cdn.com/training-images.zip"}}'

# 3. Poll the training status
bun run skills/replicate/scripts/index.ts trainings get <training_id>

# 4. When training succeeds, use the resulting model
bun run skills/replicate/scripts/index.ts predictions create \
  "your-username/my-lora" \
  '{"prompt":"photo of sks person wearing sunglasses"}'
```

## Prediction Lifecycle

When you create a prediction, the API returns immediately with a `status` field. The agent **must poll** using `predictions get <id>` until the status is terminal.

| Status       | Meaning                                       |
| ------------ | --------------------------------------------- |
| `starting`   | Worker is booting up. Can take a few seconds. |
| `processing` | The model is actively running.                |
| `succeeded`  | Completed successfully. Check `output` field. |
| `failed`     | An error occurred. Check `error` field.       |
| `canceled`   | Canceled by the user.                         |

**Important notes:**

- Output file URLs expire after **1 hour**. Download them promptly.
- Use `--prefer=wait=60` for sync mode (waits up to 60s), but polling is preferred for reliability.
- Fire multiple predictions concurrently rather than sequentially.

## Files API

The Files API lets you upload images, videos, and other assets to use as model inputs. This is critical for image editing workflows.

Uploaded files get a Replicate-hosted URL you can pass in prediction `input` objects.

## Error Handling

The script handles all errors and returns clear plain text messages:

**Missing API token:**

```
Error: REPLICATE_API_TOKEN environment variable is required. Set it with: export REPLICATE_API_TOKEN=<your_token> (Status: 401)
```

**Invalid arguments:**

```
Error: Usage: predictions create <version> <input_json> (Status: 400)
```

**API error:**

```
Error: Replicate API error (404): Not found (Status: 404)
```

**Network error:**

```
Error: Network error: fetch failed (Status: 0)
```

Errors are returned as plain text for simple messages, or Markdown for complex results. Always check if the output starts with "Error:" to detect failures.

## Rate Limits & Data Retention

- Predictions created through the API have input/output data removed after **1 hour** by default.
- There are rate limits on prediction creation. Check the [official docs](https://replicate.com/docs/topics/predictions/rate-limits) for current limits.
- Save copies of output files if you need them beyond 1 hour.

## Security

- Never log or expose `REPLICATE_API_TOKEN`.
- Never commit the token to version control.
- Use HTTPS URLs for file inputs when possible.
- Output URLs are signed and expire; treat them as temporary.

## Sources for Future Updates

When updating this skill, refer to these official sources:

- **API Documentation**: https://replicate.com/docs/reference/http
- **OpenAPI Schema**: https://api.replicate.com/openapi.json
- **LLMs.txt Overview**: https://replicate.com/docs/llms.txt
- **Official Skill Reference**: https://skills.sh/replicate/skills/replicate
- **Bun Installation Docs**: https://bun.com/docs/installation
- **Replicate Node.js Client**: https://github.com/replicate/replicate-javascript
