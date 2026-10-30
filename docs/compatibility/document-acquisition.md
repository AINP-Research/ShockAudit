# Document acquisition

The evidence-review service bounds document retrieval and records extraction limits explicitly. These contracts support saved workflows and are covered by compatibility tests. The six-screen research journey is described in the [operating manual](../OPERATING-MANUAL.md).

## Retrieval bounds

The evidence-review route permits four document attempts to fill three usable document-text slots. PDF content that cannot be processed remains an explicit extraction gap; metadata is not relabeled as extracted body text. The production runtime has no model-backed document converter.

These limits describe the retained route, not the number of sources in the current policy review or the number of current design checks.

See [Architecture](../ARCHITECTURE.md) for system boundaries and [Testing](../TESTING.md) for validation commands. The complete interface specification is available in [Git history](https://github.com/AINP-Research/ShockAudit/blob/08b4549878680f2c3f7fd55c16c4bbc40b0b5b5e/docs/screens/SCREEN-03.md).
