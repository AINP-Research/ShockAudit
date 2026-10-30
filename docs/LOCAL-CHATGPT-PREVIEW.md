# Local preview

The Windows preview runs a local Worker and connects it to ChatGPT through the existing tunnel. It uses the `codex/local-chatgpt-preview` branch. The production application continues to use `main`.

## Prerequisites

Install Git for Windows and Node.js 22 LTS. In ChatGPT, open Security and login, enable Developer mode, and use Download tunnel-client when setting up the tunnel. The established tunnel is `tunnel_6aad607472bc81919f2e4caa13eec606`; its MCP target is `http://127.0.0.1:8787/mcp`.

## Setup and start

Run commands from the repository root. Windows helpers are grouped under `scripts/windows/` and resolve the repository paths from their own location.

```powershell
git switch codex/local-chatgpt-preview
.\scripts\windows\Setup-ShockAudit-Local-Preview.ps1
.\scripts\windows\Configure-ShockAudit-OpenAI.ps1
.\scripts\windows\Start-ShockAudit-Local-Preview.ps1
```

The configuration helper writes local settings to the ignored `.dev.vars` file. It does not install a production secret. The launcher checks the branch, build identity, and local process before starting or reusing the Worker.

In another PowerShell window in the same folder, start the tunnel:

```powershell
.\scripts\windows\Start-ShockAudit-Tunnel.ps1
```

For the ChatGPT Connection, select the existing Tunnel or use Create and then Scan tools as the setup screen requires. Use the plus (+) control to open the local connection in a conversation. Keep the local connection distinct from the production connection.

## Update and restart

```powershell
.\scripts\windows\Stop-ShockAudit-Local-Preview.ps1
git switch codex/local-chatgpt-preview
git pull --ff-only origin codex/local-chatgpt-preview
.\scripts\windows\Start-ShockAudit-Local-Preview.ps1
```

Restart the tunnel if it stopped, then reopen the preview. The displayed source identifier should match the pulled revision. A restart alone does not download newer source.

## Verification and stop

Use `scripts/windows/Test-ShockAudit-Screens34.ps1` or the commands in the [testing guide](TESTING.md) for the appropriate checks. The stop helper terminates only recorded processes that match the expected local Worker or tunnel command.

Do not open or merge a pull request to publish ordinary local-preview work to production. A production release is a separate action governed by the [deployment guide](DEPLOYMENT.md).
