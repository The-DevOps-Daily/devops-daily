---
title: 'Build and Deploy a Ticket Triage App with DigitalOcean Inference'
excerpt: 'Build a practical FastAPI ticket triage app with DigitalOcean Serverless Inference, then deploy it to App Platform with Terraform.'
category:
  name: 'Cloud'
  slug: 'cloud'
date: '2026-08-01'
publishedAt: '2026-08-01T09:00:00Z'
updatedAt: '2026-08-01T09:00:00Z'
readingTime: '22 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DigitalOcean
  - Serverless Inference
  - AI
  - FastAPI
  - Terraform
  - App Platform
---

Using a hosted model does not need to begin with GPU setup, model weights, or a
large application. With DigitalOcean Serverless Inference, the model is already
running. Your application chooses a model, sends an API request, and receives a
response.

This guide turns that simple request into a small application you can try
locally and then deploy. We will build a support ticket triage demo with
[DigitalOcean Serverless Inference](https://docs.digitalocean.com/products/inference/how-to/si-overview/).

If you only want to make the smallest possible API request, start with our
[first DigitalOcean serverless inference call](/posts/digitalocean-serverless-inference-first-call).
This guide starts where that one stops: it puts inference behind a real API,
validates the model output, adds a browser interface, and deploys the result.

Support tickets are a useful example because they rarely arrive as tidy data.
A customer may describe several problems in one message, leave out an important
detail, or use an urgent tone for an issue that is not actually blocking their
work. Before a support engineer can help, someone usually needs to summarize
the request, decide where it belongs, and work out what should happen next.

Our demo uses inference for that first pass. The result is not just a chat
response. It is a structured record that the application can validate and
display.

For each ticket, the application returns:

- A factual summary
- A category and urgency level
- The customer's apparent sentiment
- Routing tags
- A recommended next action
- A draft response for a human to review

The local version uses FastAPI with a small HTML and JavaScript interface.
Later, we use Docker and Terraform to run the same project on DigitalOcean App
Platform. The complete code is available in the companion repository:

```github
https://github.com/The-DevOps-Daily/do-inference-ticket-triage
```

The deployment in this guide was tested end to end. Terraform created the App
Platform application from the GitHub repository, App Platform built the
Dockerfile, the deployed API called MiMo successfully, and Terraform removed
the application afterward.

By the end, you will understand where inference fits into a normal web
application, why model output still needs validation, and how the same project
can run locally or on App Platform.

## How does the demo work in practice?

The easiest way to understand the project is to follow one ticket.

Imagine that a customer submits this:

> Since this morning's deployment, checkout requests take more than 30 seconds
> and many return a 504. Customers cannot complete purchases.

The browser sends that ticket to our FastAPI backend. FastAPI checks that the
input has the expected fields and then sends it to a model through DigitalOcean
Serverless Inference. The model reads the ticket and returns fields such as
`summary`, `category`, and `urgency`. FastAPI checks those fields before the
browser displays them.

The flow looks like this:

```diagram
{
  "type": "flow",
  "title": "One ticket through the deployed demo",
  "nodes": [
    { "label": "Browser", "sub": "submits a ticket", "icon": "globe", "tone": "blue" },
    { "label": "FastAPI", "sub": "validates input and holds the key", "icon": "server", "tone": "violet" },
    { "label": "Serverless Inference", "sub": "runs mimo-v2.5-pro", "icon": "cpu", "tone": "accent" },
    { "label": "Validated result", "sub": "renders in the browser", "icon": "check", "tone": "green" }
  ]
}
```

There are two DigitalOcean services in the final deployment, and they have
different jobs:

- **Serverless Inference** runs the selected model and produces the analysis.
- **App Platform** runs our FastAPI application and serves the browser
  interface.

We are not training MiMo or deploying its model weights. DigitalOcean already
hosts the model. Our application sends requests to an API and pays for the
input and output tokens it uses. This is what _inference_ means here: giving new
input to an existing model and receiving a result.

The repository is not a finished helpdesk product. It leaves out storage and
external integrations so we can focus on turning unstructured text into data
the application understands.

## Why is this a useful first inference project?

This demo keeps the first experience practical:

- The input is ordinary text that is easy to understand.
- The result appears immediately as useful fields in a browser.
- DigitalOcean hosts the model, so there is no model server or GPU to manage.
- The backend makes one normal HTTPS request to use inference.
- The same code works locally and on App Platform.

There is no database, helpdesk integration, or background job to configure.
Those would be useful in a larger product, but they would hide the small part
we want to learn first: how an application sends text to a hosted model and
uses the result.

### What does it take to see it work?

The first local run has four main steps:

1. Create a model access key in DigitalOcean.
2. Add the key and model ID to a local `.env` file.
3. Start the FastAPI application.
4. Submit the example ticket in the browser or with `curl`.

That is enough to make a real inference request. Docker and Terraform come
later, when we package and deploy the same application. They are not required
to understand or try Serverless Inference locally.

### Why add structure around the model?

A first experiment with a language model often starts with a prompt and a
printed response. That is useful for checking whether a model can understand
the task, but an application needs more structure.

Our browser expects fields such as `urgency`, `category`, and
`recommended_action`. If the model returns different field names on every
request, the interface cannot use them reliably. If it returns an unknown
urgency such as `urgent-ish`, our routing logic would not know what to do.

This project adds three boundaries around the model:

1. Pydantic validates the ticket before the request leaves our API.
2. A function-tool schema tells the model which fields it should return.
3. Pydantic validates the returned tool arguments before they reach the
   browser.

The model is useful because it can interpret natural language. The surrounding
Python code is useful because it keeps the result within rules the application
understands. We need both.

The FastAPI backend also keeps the model access key away from browser code. The
browser only knows about our local `/api/triage` route. It never receives the
DigitalOcean credential.

## Prerequisites

For the first local run, you need:

- Python 3.11 or later
- Git
- A DigitalOcean account
- A positive Serverless Inference prepaid balance
- A model access key scoped to MiMo V2.5 Pro

The later packaging and deployment sections also use:

- A GitHub repository that DigitalOcean App Platform can access
- Docker if you want to test the container locally
- Terraform 1.6 or later for the deployment section
- A DigitalOcean personal access token for the deployment section

DigitalOcean Serverless Inference is prepaid and charges for input and output
tokens. Make sure the team you are using has a positive balance before testing
the application.

### Create a model access key

In the DigitalOcean Control Panel, open **Inference**, select **Manage**, and
click **Create model access key**. Give the key a clear name such as
`ticket-triage-local`, select **MiMo V2.5 Pro**, and choose **No VPC network**
for local testing.

The model ID used by the API is:

```text
mimo-v2.5-pro
```

DigitalOcean lists MiMo V2.5 Pro as supporting Chat Completions, function
calling, and structured output. Model availability can depend on the account,
so the model picker in your team's Control Panel is the final check. See
[Supported Models](https://docs.digitalocean.com/products/inference/details/models/)
for current model IDs and features.

Copy the secret as soon as it appears. DigitalOcean only displays it once.
Model access keys can be limited to selected models, which is safer than giving
the application a broad account token. The
[model access key guide](https://docs.digitalocean.com/products/inference/how-to/manage-model-access-keys/)
describes the current options.

Do not paste the key into an issue, screenshot, Git commit, or frontend file.

## Clone and configure the project

Clone the companion repository:

```bash
git clone https://github.com/The-DevOps-Daily/do-inference-ticket-triage.git
cd do-inference-ticket-triage
```

Create a virtual environment and install the application with its development
tools:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

Copy the example environment file:

```bash
cp .env.example .env
chmod 600 .env
```

Open `.env` and add the model access key:

```dotenv
DIGITALOCEAN_INFERENCE_KEY=replace-with-your-model-access-key
DIGITALOCEAN_INFERENCE_MODEL=mimo-v2.5-pro
DIGITALOCEAN_INFERENCE_BASE_URL=https://inference.do-ai.run/v1
INFERENCE_TIMEOUT_SECONDS=45

APP_ACCESS_TOKEN=
```

`DIGITALOCEAN_INFERENCE_KEY` authenticates the backend to Serverless
Inference. `DIGITALOCEAN_INFERENCE_MODEL` selects the model, and the base URL
points to DigitalOcean's OpenAI-compatible API.

`APP_ACCESS_TOKEN` has a separate purpose. When set, it acts as a shared access
code for a short-lived public demo. It is not a DigitalOcean key, and it is not
a replacement for real user authentication. Leave it empty while working
locally.

The repository's `.gitignore` excludes `.env`, but it is still worth checking:

```bash
git check-ignore .env
```

The command should print `.env`.

## Try the complete flow locally

It helps to see the full request flow once before looking at each part.

Export the values from `.env` and start FastAPI:

```bash
set -a
source .env
set +a

uvicorn app.main:app --reload --port 8080
```

Open [http://localhost:8080](http://localhost:8080), select **Load example**,
and submit the ticket. The right side of the page will show the category,
urgency, sentiment, tags, next action, and draft response. It also shows which
model answered, how long the request took, and how many tokens were used.

The interface is optional. You can call the same backend route with `curl`:

```bash
curl --request POST http://localhost:8080/api/triage \
  --header 'Content-Type: application/json' \
  --data '{
    "subject": "Production checkout is timing out",
    "description": "Every checkout request takes more than 30 seconds and purchases are blocked.",
    "customer_plan": "business"
  }'
```

This is important: the browser is only a convenient client. The main demo is
the API path from FastAPI to DigitalOcean Inference and back.

If your goal is to understand Serverless Inference at a high level, you have
now seen the core workflow. The next section opens the application and explains
how it turns the model response into data the rest of the code can trust.

## Under the hood: from ticket to validated result

Only one part of the application talks to DigitalOcean's inference endpoint.
The surrounding code prepares a clear request, protects the credential, and
checks the response. You do not need all of these pieces for a first API call,
but they show how inference fits into a real web application.

### Define the data before writing the prompt

The project starts by deciding which input and output the application accepts.
These models live in `app/models.py`.

The incoming ticket has three fields:

```python
class TicketRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    subject: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=20, max_length=5_000)
    customer_plan: Literal["starter", "business", "enterprise"] = "starter"
```

The length limits reject empty or unexpectedly large requests before they use
model credits. `extra="forbid"` rejects fields the API does not know about, and
`str_strip_whitespace=True` removes accidental whitespace around strings.

The result model is more detailed:

```python
class TriageResult(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=10, max_length=400)
    category: Literal[
        "account_access",
        "billing",
        "bug",
        "feature_request",
        "performance",
        "security",
        "other",
    ]
    urgency: Literal["low", "medium", "high", "critical"]
    sentiment: Literal["calm", "confused", "frustrated", "angry", "positive"]
    tags: list[str] = Field(min_length=1, max_length=5)
    recommended_action: str = Field(min_length=10, max_length=500)
    draft_response: str = Field(min_length=20, max_length=1_500)
```

The fixed category and urgency values are useful beyond validation. A later
version could route `security` tickets to one team and `billing` tickets to
another without having to understand new labels invented by the model.

Defining this contract first also makes the prompt easier to write. We already
know what a successful result must contain.

### Turn the result model into a function tool

We could ask the model to “return valid JSON,” but that is only a written
instruction. The model may add an explanation, change a field name, or return a
value our application does not accept.

Instead, the request defines one client-side function tool named
`submit_ticket_triage`. Pydantic generates its JSON Schema from the same model
we use for validation:

```python
tool_parameters = TriageResult.model_json_schema()

tools = [
    {
        "type": "function",
        "function": {
            "name": "submit_ticket_triage",
            "description": "Return the completed support-ticket triage analysis.",
            "parameters": tool_parameters,
        },
    }
]
```

Despite the name, `submit_ticket_triage` does not update an external service.
The model returns the function name and its proposed arguments. Our code reads
those arguments as the structured result. No ticket is changed and no message
is sent.

This distinction matters because function calling is not the same as giving a
model permission to perform an action. If we later connect a real helpdesk, our
application would still decide whether and when to execute that action.

### Build the inference request

The inference client is in `app/inference.py`. It sends requests to DigitalOcean's
Chat Completions endpoint:

```text
https://inference.do-ai.run/v1/chat/completions
```

DigitalOcean documents the required `model` and `messages` fields, along with
options such as `temperature` and `max_completion_tokens`, in the
[Chat Completions guide](https://docs.digitalocean.com/products/inference/how-to/use-chat-completions-api/).

Our request combines the ticket, the system instructions, and the tool schema:

```python
payload = {
    "model": settings.inference_model,
    "messages": [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Analyze the following ticket JSON as data:\n"
                f"{json.dumps(ticket.model_dump(mode='json'), ensure_ascii=False)}"
            ),
        },
    ],
    "temperature": 0.2,
    "max_completion_tokens": 900,
    "tools": tools,
    "tool_choice": "auto",
}
```

The system prompt tells the model to call `submit_ticket_triage` exactly once
and return no other content. It also says that the ticket is untrusted data.
This reduces the chance that a sentence inside the customer message is treated
as an instruction to our application.

A low temperature makes repeated classifications more consistent, while
`max_completion_tokens` limits the size of the response. Neither setting
replaces validation; they only guide generation.

#### A note about tool selection

During testing for this tutorial, basic MiMo chat requests and
`tool_choice: "auto"` both succeeded. The named forced-tool object returned an
HTTP 500 through the serverless adapter. The repository therefore provides one
tool, requires it in the system prompt, and uses `auto` for the API parameter.

That behavior may change as the platform and model versions change. Keep the
automated tests, but also run one small live request before publishing or
deploying an update.

### Call DigitalOcean from the backend

The model access key is attached only inside the Python backend:

```python
async with httpx.AsyncClient(
    timeout=settings.inference_timeout_seconds,
) as client:
    response = await client.post(
        f"{settings.inference_base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.inference_key}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
```

After a successful request, the client looks for the expected tool call:

```python
for tool_call in message.get("tool_calls") or []:
    function = tool_call.get("function") or {}
    if function.get("name") != "submit_ticket_triage":
        continue

    arguments = function.get("arguments")
    if isinstance(arguments, str):
        arguments = json.loads(arguments)

    return TriageResult.model_validate(arguments)
```

`model_validate` is the final gate. If the model leaves out `urgency`, returns
six tags, or adds an unknown field, validation fails. The API returns a safe
error instead of passing incomplete data to the interface.

The client also separates common provider failures:

- A missing local key becomes a configuration error.
- HTTP 401 means the key was rejected.
- HTTP 403 suggests that the key scope or account tier does not allow the
  selected model.
- HTTP 429 tells the caller to retry later.
- Timeouts and other provider errors become safe gateway errors.

This error handling proved useful while building the demo. A key can be valid
enough to list models while a completion is still denied for a model that is
not available to the current account tier.

### Put FastAPI between the browser and the model

The public endpoint in `app/main.py` accepts a validated `TicketRequest` and
returns a validated `TriageResponse`:

```python
@application.post("/api/triage", response_model=TriageResponse)
async def triage_ticket(
    ticket: TicketRequest,
    x_app_access_token: str | None = Header(default=None),
) -> TriageResponse:
    _require_app_access(runtime_settings, x_app_access_token)
    return await application.state.inference_client.triage(ticket)
```

The complete route wraps that call with the error handling described above.
There is also a `/health` endpoint that returns `{"status": "ok"}` without
calling the model. App Platform can check whether the web process is healthy
without creating an inference charge.

FastAPI is doing more than forwarding requests. It is the boundary that:

- Protects the model credential
- Rejects invalid tickets
- Controls which model features the application uses
- Validates the model's result
- Gives the browser a stable API

### Add a small browser interface

The interface uses plain HTML, CSS, and JavaScript. It is intentionally small
because the tutorial is about the inference path, not a frontend framework.

When the form is submitted, `app/static/app.js` sends the ticket to our API. If
the deployment uses a demo access code, the script adds it to a separate
header:

```javascript
const headers = { 'Content-Type': 'application/json' };
if (accessCode) {
  headers['X-App-Access-Token'] = accessCode;
}

const response = await fetch('/api/triage', {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
```

The script renders the validated fields with `textContent`. It does not insert
model output as HTML. The FastAPI application also adds a Content Security
Policy and other browser security headers.

If `APP_ACCESS_TOKEN` is set, the interface displays an access-code field and
sends the value in the `X-App-Access-Token` header. This is useful for limiting
casual access to a temporary demo, but a real product should use individual
accounts and proper authorization.

## What does a real response look like?

The following is a shortened version of the response returned during an
end-to-end test through the deployed App Platform application:

```json
{
  "analysis": {
    "category": "bug",
    "urgency": "critical",
    "sentiment": "frustrated",
    "tags": ["deployment", "checkout", "504-error", "production-outage", "regression"]
  },
  "model": "mimo-v2.5-pro",
  "latency_ms": 10155,
  "usage": {
    "total_tokens": 1619
  }
}
```

The exact wording, latency, and token counts vary. The important part is that
the shape stays the same and the values pass our rules.

The draft response is still a draft. A support engineer should review it
before sending it to a customer. Validation can confirm structure, but it
cannot confirm every factual statement or business decision.

## Test without spending inference credits

Automated tests should be fast and repeatable. They should not fail because a
provider is temporarily unavailable, and they should not spend model credits
every time someone pushes a commit.

The API tests inject a fake inference client. Lower-level tests use
`httpx.MockTransport` to inspect the outgoing request and return a realistic
tool-call response.

The tests cover:

- Ticket validation
- The inference URL and authorization header
- Model selection
- The generated JSON Schema
- Tool-call parsing
- Invalid model arguments
- Authentication and model-access errors
- Rate limiting
- Secret protection in the public configuration route

Run all local checks with:

```bash
ruff check .
ruff format --check .
pytest
```

At the time of writing, the repository contains 11 passing tests. These tests
do not need `DIGITALOCEAN_INFERENCE_KEY`.

Keep one manual live test in your release process as well. Mocked tests confirm
our code, while the live test confirms the current model and API still accept
the request.

## Run the application in Docker

The Dockerfile installs the Python package, switches to an unprivileged user,
exposes port 8080, and starts Uvicorn.

Build the image:

```bash
docker build -t do-inference-ticket-triage .
```

Run it with the local environment file:

```bash
docker run --rm \
  --publish 8080:8080 \
  --env-file .env \
  do-inference-ticket-triage
```

Check the container without calling the model:

```bash
curl http://localhost:8080/health
```

You should receive:

```json
{ "status": "ok" }
```

The key is passed at runtime. It is not copied into the image.

## Deploy to App Platform with Terraform

The local test already proves that the application can call Serverless
Inference. Deploying it does not add new model infrastructure. It only moves
the FastAPI application from your computer to DigitalOcean App Platform so
other people can open it through a public URL.

The Terraform configuration for this step is in the `terraform/` directory.

Terraform deploys the web application, not the model. It creates one App
Platform application that builds the repository's Dockerfile and runs FastAPI.
When a ticket arrives, FastAPI calls the already-hosted Serverless Inference
API with the model access key.

Before applying the configuration, push the project to GitHub. The Terraform
resource expects the repository in `owner/repository` format and deploys from
the `main` branch by default.

### Give App Platform access to GitHub

Terraform can point App Platform at a repository, but it cannot complete the
GitHub authorization for your account. In the DigitalOcean Control Panel:

1. Open **App Platform** and start creating an app.
2. Select **GitHub** as the source.
3. Connect the GitHub account that owns the repository.
4. Give DigitalOcean access to the repository.
5. Stop before creating the app manually. Terraform will create it.

For a private repository, check the GitHub connection's repository permissions.
If the repository was created after you first connected GitHub, you may need
to open **Manage access** and add it.

If Terraform returns `GitHub user not authenticated`, the DigitalOcean team is
not connected to the correct GitHub account or does not have access to that
repository. Fix the GitHub connection in App Platform, then run the plan again.

Copy the example variable file:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Set your repository:

```hcl
github_repo = "The-DevOps-Daily/do-inference-ticket-triage"
```

The deployment needs two different DigitalOcean credentials:

- `DIGITALOCEAN_TOKEN` is a control-plane token used by Terraform to create the
  App Platform application.
- `TF_VAR_inference_key` becomes the model access key used by the deployed
  FastAPI service.

Create the control-plane token with the App Platform scopes `app:create`,
`app:read`, `app:update`, and `app:delete`. The delete scope is needed for the
cleanup step. This token and the model access key are not interchangeable.

Export them without adding them to `terraform.tfvars`:

```bash
export DIGITALOCEAN_TOKEN="your-control-plane-token"
export TF_VAR_inference_key="your-model-access-key"
export TF_VAR_app_access_token="a-long-random-demo-access-code"
```

The `digitalocean_app` resource connects App Platform to GitHub, builds the
root Dockerfile, exposes port 8080, and configures `/health` as the health
check. It adds the inference key and demo access code as `SECRET` runtime
variables. The model ID and inference URL are regular runtime configuration.

The
[DigitalOcean Terraform provider documentation](https://docs.digitalocean.com/reference/terraform/reference/resources/app/)
has the full reference for the `digitalocean_app` resource.

Initialize Terraform and download the provider:

```bash
terraform init
```

Check formatting and validate the configuration:

```bash
terraform fmt -check
terraform validate
```

Review the planned change and save it:

```bash
terraform plan -out=deploy.tfplan
```

For a new deployment, the summary should show one `digitalocean_app` resource
to add and no unrelated changes. Apply that exact plan:

```bash
terraform apply deploy.tfplan
```

Terraform prints the App Platform resource details when the deployment is
complete. Retrieve the public URL with:

```bash
terraform output -raw app_url
```

Store the URL in a shell variable and check the routes that do not call the
model:

```bash
APP_URL=$(terraform output -raw app_url)

curl "$APP_URL/health"
curl "$APP_URL/api/config"
```

The health route should return `{"status":"ok"}`. The configuration route
should show `mimo-v2.5-pro` and confirm that an access code is required.

Now send one real ticket through the deployed application:

```bash
curl --request POST "$APP_URL/api/triage" \
  --header 'Content-Type: application/json' \
  --header "X-App-Access-Token: $TF_VAR_app_access_token" \
  --data '{
    "subject": "Production checkout is timing out",
    "description": "Every checkout request is taking more than 30 seconds and purchases are blocked.",
    "customer_plan": "business"
  }'
```

A successful response has HTTP status 200 and contains the validated
`analysis`, `model`, `latency_ms`, and `usage` fields. The same request without
the access-code header should return HTTP 401. Finally, open the URL, load the
example ticket, enter the demo code, and confirm that the browser renders the
result.

This sequence tests the complete path: browser or `curl`, App Platform,
FastAPI, Serverless Inference, MiMo, validation, and the response back to the
client.

App Platform can deploy new commits automatically because the Terraform
configuration sets `deploy_on_push = true`.

> **Protect Terraform state:** Marking a variable as sensitive hides it from
> normal terminal output, but Terraform still stores its value in state. Use an
> encrypted remote backend with limited access for shared or long-lived
> deployments. Never commit `terraform.tfstate` or `terraform.tfvars`.

## What should change before production?

This repository is a teaching project, but its boundaries point toward the work
a production version would need.

**Use real authentication.** Replace the shared demo code with individual user
accounts, roles, and authorization checks.

**Add rate limits.** A public endpoint can spend inference credits. Limit
requests per user and consider a team-wide budget.

**Keep humans in the workflow.** The application should suggest a category,
action, and response. A person should approve decisions that affect customers,
billing, security, or incident response.

**Store only what you need.** Support tickets may contain personal or business
data. Decide what can be logged, how long it is retained, and who can access
it.

**Measure quality.** Create a set of example tickets with expected categories
and urgency levels. Run them when the prompt or model changes. A successful
HTTP response does not mean every classification is correct.

**Monitor provider behavior.** Record safe metrics such as latency, status
codes, token use, and validation failures. Avoid logging raw ticket text unless
your privacy rules allow it.

**Rotate credentials.** Use separate model access keys for development,
staging, and production. Scope each key only to the models its application
needs.

Possible extensions include saving triage history in PostgreSQL, adding Zendesk
or Intercom integration, sending approved alerts to Slack or PagerDuty, and
comparing models with a fixed evaluation dataset.

## Clean up

Keep the Terraform variables exported while cleaning up. First review the
destroy plan:

```bash
terraform plan -destroy -out=destroy.tfplan
terraform apply destroy.tfplan
```

Confirm that Terraform no longer manages any resources:

```bash
terraform state list
```

The command should print nothing. You can also check App Platform in the
DigitalOcean Control Panel.

Terraform state and backup files can contain secret values even after the
application is destroyed. For a one-off local demo, after confirming that the
state is empty, remove the local state and saved plans:

```bash
rm -f terraform.tfstate terraform.tfstate.backup deploy.tfplan destroy.tfplan
```

Terraform does not delete the GitHub repository, the model access key, or the
Serverless Inference prepaid balance. It also does not revoke the control-plane
token. Revoke unused tokens and keys separately in the DigitalOcean Control
Panel.

## Conclusion

Getting started with DigitalOcean Serverless Inference required only a hosted
model, a model access key, and an API request. The ticket triage demo made that
request visible: submit ordinary text and receive useful fields that an
application can understand.

The browser collects the ticket. FastAPI validates it and protects the
credential. DigitalOcean Serverless Inference runs MiMo V2.5 Pro. A function
tool gives the result a predictable shape, and Pydantic checks that shape
before the interface uses it. Docker packages the service, while Terraform
describes how App Platform should run it.

The local version shows how easy it is to make the first inference call. The
rest of the project shows how to make that call safer, repeatable, and ready to
deploy. The same pattern can be reused for document classification, content
review, data extraction, and many other text-processing tasks.
