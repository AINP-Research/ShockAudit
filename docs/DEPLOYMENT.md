# Deployment

ShockAudit runs as the `shockaudit` Cloudflare Worker, built from the `main` branch of `AINP-Research/ShockAudit`. The ChatGPT connection is named **ShockAudit - A Natural Experiment tool**. Runtime configuration is in `wrangler.jsonc`; source release and UI resource identities are defined in `src/version.ts`.

## Application releases

Validate the proposed revision using the [testing guide](TESTING.md) and review the complete diff before publishing. The production branch verifier requires `main` and an exact expected commit. Manual deployment also checks the fetched remote branch and a clean working tree.

Cloudflare Workers Builds runs the production build and release gates before deployment. GitHub Actions independently runs dependency audits, regression checks, browser acceptance, and artifact checks. After deployment, verify the delivered source identity, resource catalog, MCP journeys, and production matrix.

Build success, endpoint readiness, automated browser acceptance, and a signed-in researcher journey are separate observations. Record the checks performed and their limits.

## Build watch paths

A push to `main` can trigger Workers Builds independently of GitHub Actions. The browser build embeds the source commit, so rebuilding identical application source can change its visible build identifier.

Documentation and development-tool maintenance that must leave production untouched needs matching build-watch exclusions before merge. Review every added, modified, and deleted path against the Worker's configured rules, including both locations of a moved file. Exclude only paths outside production build and runtime inputs. A GitHub Actions skip marker does not replace Cloudflare build-watch settings.

See Cloudflare's [build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/) reference. Hold a maintenance change on its branch until the exclusions cover its complete diff.

## Configuration and saved state

The root `wrangler.jsonc` is the production configuration. Profiles under `config/previews/` support isolated compatibility checks and are not selected by production commands. Windows development helpers live under `scripts/windows/`.

Store production credentials, including `OPENAI_API_KEY` and `OPENSTATES_API_KEY`, as encrypted Worker secrets and keep local `.dev.vars` files untracked. Preserve the Durable Object binding, migration history, published MCP resource identities, and saved-state contracts unless the release explicitly includes a reviewed migration.

Release evidence belongs in bounded Actions artifacts governed by the [evidence retention policy](operations/actions-evidence.md).
