# Documentation

## Using ShockAudit

- [Operating manual](OPERATING-MANUAL.md): the current six-screen workflow and researcher decisions.
- [Evidence policy](EVIDENCE-POLICY.md): source support, interpretation, uncertainty, and scientific limits.

## Developing and operating the application

- [Architecture](ARCHITECTURE.md): application components, persistence, and compatibility boundaries.
- [Source integrations](SOURCE-ADAPTERS.md): source routing and the distinction between active and retained adapters.
- [Local preview](LOCAL-CHATGPT-PREVIEW.md): the Windows development workflow.
- [Testing](TESTING.md): regression, browser, artifact, and live verification commands.
- [Deployment](DEPLOYMENT.md): production identity, release checks, and build configuration.
- [Actions evidence](operations/actions-evidence.md): validation artifacts, size limits, and retention.
- [Contribution guide](../.github/CONTRIBUTING.md): repository structure and documentation conventions.

## Compatibility and validation material

[Qualification schemas and templates](qualification/README.md) and [release-evidence templates](evidence/README.md) remain available to the checks that consume them. Some describe earlier contracts and are retained for reproducibility rather than as instructions for the current interface.

The [document-acquisition contract](compatibility/document-acquisition.md) and [qualification protocol](qualification/PROTOCOL.md) describe the bounds used by compatibility checks. The [handoff evidence reference](local-preview-v26-handoff-recovery-progress.md) resolves a path required by a frozen acceptance fixture.

Development tooling is described in [scripts](../scripts/README.md). Release history is available in [Git history](https://github.com/AINP-Research/ShockAudit/commits/main/).
