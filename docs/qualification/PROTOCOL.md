# Compatibility qualification protocol

The product-qualification verifier checks a checksum-bound evidence package against the Screen 2/3 compatibility contract and its canonical eight-case corpus.

The complete protocol and evidence definitions are preserved in the [qualification specification](https://github.com/AINP-Research/ShockAudit/blob/08b4549878680f2c3f7fd55c16c4bbc40b0b5b5e/docs/SCREEN-03-PRODUCT-QUALIFICATION.md).

## Retained inputs

- `docs/qualification/SCREEN-23-GOLD-CORPUS.manifest.json` and its schema define the frozen corpus.
- `docs/qualification/benchmarks/` contains benchmark schemas.
- `docs/qualification/templates/` contains case, domain, usability, performance, signed-in, and approval record shapes.
- `scripts/check-product-qualification.mjs` validates the corresponding checksum-bound evidence package.

Run `npm run check:product-qualification` only with the required evidence directory available. A missing record remains incomplete. `npm run check:post-deployment-acceptance` is a separate verifier with its own inputs; passing one check does not establish the other.

See the current [operating manual](../OPERATING-MANUAL.md), [testing guide](../TESTING.md), and [deployment guide](../DEPLOYMENT.md) for the present workflow.
