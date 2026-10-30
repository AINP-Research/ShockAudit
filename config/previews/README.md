# Preview profiles

These Wrangler profiles support isolated preview and compatibility checks. Production uses `wrangler.jsonc` at the repository root; its package commands and workflows do not select these profiles.

| Profile | Scope |
| --- | --- |
| `wrangler.stage1-preview.jsonc` | Stage 1 preview with its dedicated Worker identity and preview flags. |
| `wrangler.stage6-preview.jsonc` | Stage 6 compatibility profile with search expansion measured in shadow mode. |
| `wrangler.stage6-on-preview.jsonc` | Stage 6 compatibility profile with search expansion enabled and context kept as metadata leads. |

Entrypoint, asset-directory, and schema paths resolve from this folder. Keep Worker identities, bindings, migrations, and profile flags intact when maintaining these files. See [Deployment](../../docs/DEPLOYMENT.md) for the production release process.
