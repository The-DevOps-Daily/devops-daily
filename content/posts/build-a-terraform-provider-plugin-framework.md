---
title: 'Build a Terraform Provider for Your API with the Plugin Framework'
excerpt: 'If your product has a REST API, a Terraform provider lets people manage it as code. Here is how to build one with the modern Terraform Plugin Framework, using a real email API as the example, from client to registry.'
category:
  name: 'Terraform'
  slug: 'terraform'
date: '2026-07-16'
publishedAt: '2026-07-16T10:00:00Z'
updatedAt: '2026-07-16T10:00:00Z'
readingTime: '13 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Terraform
  - Go
  - IaC
  - DevOps
  - APIs
---

If your product has a REST API, there is a good chance your users want to manage it with Terraform. Teams that run everything as code do not want to click around a dashboard to add a domain or rotate an API key. They want it in a `.tf` file, in a pull request, next to the rest of their infrastructure.

Giving them that means writing a Terraform provider. It sounds heavier than it is. With the modern [Terraform Plugin Framework](https://developer.hashicorp.com/terraform/plugin/framework), a small provider that wraps a handful of endpoints is a weekend project, and most of it is boilerplate you can copy. This post walks through the moving parts using a real example: a provider for a transactional email API that manages sending domains, API keys, and webhooks. The full source is linked at the end.

## TLDR

- A Terraform provider is a Go binary that speaks a gRPC protocol to Terraform. The **Plugin Framework** (not the older SDKv2) is the current way to write one.
- The pieces are always the same: an **API client**, a **provider** (auth and config), and one **resource** per thing you can create, each implementing Create, Read, Update, and Delete.
- The pattern that makes a provider genuinely useful is **computed outputs**: return values from the API (like the DNS records a domain needs) so users can wire them straight into other resources in the same `apply`.
- Test with **unit tests** against an `httptest` server and **acceptance tests** gated behind `TF_ACC` that hit the real API.
- Ship it by generating docs with **tfplugindocs** and cutting a signed release with **GoReleaser**, then registering it on the Terraform Registry.

## Prerequisites

- Comfort with **Go** (the provider is a Go module) and basic **Terraform** usage.
- An API with predictable CRUD endpoints and token auth. The example uses a Bearer token.
- Go installed, and the Terraform CLI for generating docs and running acceptance tests.

## The shape of a provider

Terraform does not call your API. It calls your provider binary over gRPC, and your provider calls your API. When someone runs `terraform apply`, Terraform works out the plan and then asks your provider to Create, Read, Update, or Delete each resource. Your job is to implement those methods and translate between Terraform's state and your API's JSON.

```diagram
{
  "type": "flow",
  "title": "Where a provider sits",
  "nodes": [
    { "label": "terraform apply", "sub": "core computes the plan", "icon": "gear" },
    { "label": "Provider (gRPC)", "sub": "your Go binary", "icon": "box" },
    { "label": "API client", "sub": "HTTP + Bearer token", "icon": "net" },
    { "label": "Your REST API", "sub": "CRUD endpoints", "icon": "cloud" }
  ]
}
```

The Plugin Framework gives you typed schemas, plan modifiers, and diagnostics, and it targets protocol version 6. Start from HashiCorp's [`terraform-provider-scaffolding-framework`](https://github.com/hashicorp/terraform-provider-scaffolding-framework) template or lay out the module yourself:

```text
terraform-provider-example/
├── main.go                 # serves the provider
├── internal/
│   ├── client/             # your API client
│   └── provider/           # provider + resources + data sources
├── examples/               # HCL examples (also feed the docs)
└── docs/                   # generated reference docs
```

`main.go` is almost entirely boilerplate. It serves the provider at a registry address:

```go
func main() {
	opts := providerserver.ServeOpts{
		Address: "registry.terraform.io/example/smtpfast",
	}
	if err := providerserver.Serve(context.Background(), provider.New(version), opts); err != nil {
		log.Fatal(err.Error())
	}
}
```

## Step 1: the API client

Keep the API layer separate from the Terraform layer. A plain Go client with one method per operation keeps the resource code readable and makes it easy to unit test. Nothing Terraform-specific belongs here.

```go
type Client struct {
	APIKey     string
	BaseURL    string
	HTTPClient *http.Client
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	// marshal body, set Authorization: Bearer <key>, send, and decode.
	// On a 4xx/5xx, return a typed error so resources can react to 404s.
}

func (c *Client) CreateDomain(ctx context.Context, domain string) (*Domain, error) {
	var out Domain
	err := c.do(ctx, http.MethodPost, "/v1/domains", map[string]string{"domain": domain}, &out)
	return &out, err
}
```

One detail that pays off later: give your client a typed error with a `NotFound()` helper. When a resource's Read gets a 404, the right move is to remove it from state, not to error. A small `IsNotFound(err)` check makes that clean.

## Step 2: the provider

The provider handles configuration and authentication once, then hands a ready-to-use client to every resource. It reads the token from the config block or an environment variable, so users are not forced to put secrets in `.tf` files.

```go
func (p *exampleProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var config providerModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)

	apiKey := os.Getenv("SMTPFAST_API_KEY")
	if !config.APIKey.IsNull() {
		apiKey = config.APIKey.ValueString()
	}
	if apiKey == "" {
		resp.Diagnostics.AddAttributeError(path.Root("api_key"),
			"Missing API key", "Set api_key or the SMTPFAST_API_KEY environment variable.")
		return
	}

	c := client.New(apiKey, /* base URL */ "", "terraform-provider-smtpfast")
	resp.ResourceData = c    // every resource can now grab this client
	resp.DataSourceData = c
}
```

The provider also lists which resources and data sources it exposes:

```go
func (p *exampleProvider) Resources(_ context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		NewDomainResource, NewAPIKeyResource, NewWebhookResource,
	}
}
```

## Step 3: a resource

A resource is where the work is. It declares a schema, then implements Create, Read, Update, and Delete. Here is the core of the sending-domain resource, trimmed to the shape.

The **schema** describes each attribute and how it behaves. `Computed` means the API sets it, `Required` means the user must, and plan modifiers control replacement:

```go
func (r *domainResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Attributes: map[string]schema.Attribute{
			"id":     schema.StringAttribute{Computed: true},
			"domain": schema.StringAttribute{
				Required:      true,
				PlanModifiers: []planmodifier.String{stringplanmodifier.RequiresReplace()},
			},
			"status": schema.StringAttribute{Computed: true},
			"dns_records": schema.ListNestedAttribute{
				Computed: true,
				NestedObject: schema.NestedAttributeObject{
					Attributes: map[string]schema.Attribute{
						"type":  schema.StringAttribute{Computed: true},
						"name":  schema.StringAttribute{Computed: true},
						"value": schema.StringAttribute{Computed: true},
					},
				},
			},
		},
	}
}
```

**Create** reads the plan, calls the API, and writes the result back to state:

```go
func (r *domainResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var plan domainResourceModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)

	domain, err := r.client.CreateDomain(ctx, plan.Domain.ValueString())
	if err != nil {
		resp.Diagnostics.AddError("Error creating domain", err.Error())
		return
	}

	resp.Diagnostics.Append(r.mapToState(ctx, domain, &plan)...)
	resp.Diagnostics.Append(resp.State.Set(ctx, plan)...)
}
```

**Read** is what keeps state honest and detects drift. The important behavior is the 404 case:

```go
func (r *domainResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var state domainResourceModel
	resp.Diagnostics.Append(req.State.Get(ctx, &state)...)

	domain, err := r.client.GetDomain(ctx, state.ID.ValueString())
	if err != nil {
		if client.IsNotFound(err) {
			resp.State.RemoveResource(ctx) // deleted out of band: drop it
			return
		}
		resp.Diagnostics.AddError("Error reading domain", err.Error())
		return
	}
	resp.Diagnostics.Append(r.mapToState(ctx, domain, &state)...)
	resp.Diagnostics.Append(resp.State.Set(ctx, state)...)
}
```

Delete calls the API and, again, treats a 404 as already done. If a field is immutable (like the domain name here), mark it `RequiresReplace` and you can leave `Update` empty. Add `ImportState` with a passthrough on the ID and users can `terraform import` existing resources.

## The pattern that makes it worth it

A provider that only creates things is fine. A provider that returns useful **computed outputs** is the one people actually reach for. Verifying a sending domain means publishing DKIM, SPF, DMARC, and MAIL FROM records. If the resource exposes those records as an output, a user can create the domain and publish the DNS in the same `apply`, with no copy-pasting from a dashboard:

```hcl
resource "smtpfast_domain" "example" {
  domain = "mail.example.com"
}

# The records the API returned, published straight to Cloudflare.
resource "cloudflare_record" "smtpfast" {
  for_each = { for idx, rec in smtpfast_domain.example.dns_records : idx => rec }

  zone_id = var.cloudflare_zone_id
  type    = each.value.type
  name    = each.value.name
  content = each.value.value
}
```

```terminal
{
  "title": "one apply, domain plus DNS",
  "prompt": "$",
  "steps": [
    { "cmd": "terraform apply", "output": "smtpfast_domain.example: Creating...\nsmtpfast_domain.example: Creation complete [id=dom_xyz789]\ncloudflare_record.smtpfast[\"0\"]: Creating...\ncloudflare_record.smtpfast[\"1\"]: Creating...\n\nApply complete! Resources: 3 added, 0 changed, 0 destroyed." }
  ]
}
```

That is the whole pitch for building the provider: one resource graph, one command, a fully provisioned sending domain. Look for the equivalent in your own API. Anything the service computes and the user then has to act on is a candidate for a computed output.

## Testing

Two layers, and they serve different jobs.

**Unit tests** exercise the client against an `httptest` server. They are fast, need no credentials, and run in CI on every push. Assert the request shape and the response mapping:

```go
func TestGetDomainNotFound(t *testing.T) {
	c := testServer(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	_, err := c.GetDomain(context.Background(), "missing")
	if !client.IsNotFound(err) {
		t.Fatalf("expected not-found, got %v", err)
	}
}
```

**Acceptance tests** use the Plugin Testing framework to run real `terraform apply` and `terraform import` against your live API, then destroy what they made. They are gated behind the `TF_ACC` environment variable so they never run by accident:

```go
func TestAccDomainResource(t *testing.T) {
	resource.Test(t, resource.TestCase{
		PreCheck:                 func() { testAccPreCheck(t) },
		ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
		Steps: []resource.TestStep{
			{
				Config: `resource "smtpfast_domain" "test" { domain = "tf-acc.example.com" }`,
				Check: resource.ComposeAggregateTestCheckFunc(
					resource.TestCheckResourceAttrSet("smtpfast_domain.test", "id"),
					resource.TestCheckResourceAttrSet("smtpfast_domain.test", "dns_records.#"),
				),
			},
			{ResourceName: "smtpfast_domain.test", ImportState: true, ImportStateVerify: true},
		},
	})
}
```

:::warning
Acceptance tests create and destroy real resources and cost real API calls. Use a dedicated test account, not production, and give the tests randomized names plus proper cleanup so nothing lingers.
:::

## Docs and publishing

The Terraform Registry expects a `docs/` folder. Do not write it by hand. `tfplugindocs` generates it from your schema descriptions and the files in `examples/`:

```bash
go run github.com/hashicorp/terraform-plugin-docs/cmd/tfplugindocs generate --provider-name smtpfast
```

Wire that into CI as a check that fails if the committed docs drift from the schema, and your reference docs can never go stale.

Releases are cut by **GoReleaser** on a version tag. It cross-compiles for every OS and architecture and signs the checksums with GPG, because the registry requires signed releases. A GitHub Actions workflow triggered on `v*` tags does the whole thing:

1. Generate a GPG key and add it, plus its passphrase, as repository secrets.
2. Connect the repository on the Terraform Registry and register the public key.
3. Push a `v0.1.0` tag. The release workflow builds, signs, and publishes the artifacts, and the registry picks them up.

After that, anyone can use your provider with a normal `required_providers` block:

```hcl
terraform {
  required_providers {
    smtpfast = {
      source = "smtpfast/smtpfast"
    }
  }
}
```

## The example provider

Everything above is real code from an open-source provider for the [SMTPfast](https://smtpfa.st) email API. It is a good reference for a small, complete provider: client, three resources, a data source, unit and acceptance tests, generated docs, and the release pipeline.

```github
https://github.com/smtpfast/terraform-provider-smtpfast
```

## Summary

- A Terraform provider is a Go binary that translates between Terraform's state and your API. Use the **Plugin Framework**.
- Separate the **API client** from the Terraform layer, configure **auth once** in the provider, and implement **CRUD** per resource. Treat 404 on Read as "remove from state."
- Return **computed outputs** for anything the user has to act on. That is what turns a provider from a novelty into something people build real infrastructure on.
- Cover it with **unit and acceptance tests**, generate docs with **tfplugindocs**, and publish signed releases with **GoReleaser**.

If your service has an API and any users who live in Terraform, a small provider is one of the higher-leverage things you can ship for them. Start with the one or two resources people ask about most, and grow it from there.
