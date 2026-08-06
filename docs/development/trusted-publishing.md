# Trusted publishing (npm OIDC)

Releases publish from GitHub Actions using npm trusted publishing. There is no long-lived npm
credential in this repository: the `NPM_TOKEN` secret was removed once trusted publishing was
working, so the `auto` auth mode in [`release.yml`](../../.github/workflows/release.yml)
resolves to `oidc` and every published package carries a provenance attestation.

## One record per package

npm permits exactly **one** trusted publisher per package, and each record names a specific
repository and workflow file — here, `pie-framework/pie-qti` and `release.yml`. A record
pointing somewhere else is not merely wrong; it occupies the slot this repository needs.

```bash
npm login
bun run trusted-publishers                  # dry run, changes nothing
bun run trusted-publishers -- --apply       # all packages
bun run trusted-publishers -- --apply --only @pie-qti/theme
```

Notes:

- Requires npm >= 12 for `npm trust`. The script bootstraps npm 12 into a temp prefix rather
  than upgrading your global npm.
- Every `npm trust` call is 2FA-protected and npm does not reuse the authentication between
  invocations, so expect **one OTP prompt per package** — for reads as well as writes. That is
  why this is a local operator task and never a CI step.
- `npm trust github --dry-run` exits 0 even for a package that does not exist, so a clean dry
  run proves the arguments are well-formed and nothing more.

## Adding a publishable package

Versioning is fixed (see [`.changeset/config.json`](../../.changeset/config.json)), so a
release publishes the whole fixed group together and npm authenticates the run as a whole. A
newly added package has no trusted publisher of its own, so the release publishes its siblings
and fails that one package with `ENEEDAUTH` — leaving the registry split across two versions
and git holding a version that was never fully published.

So claim the record **before** the package's first release:

```bash
npm login
bun run trusted-publishers -- --apply --only @pie-qti/<new-package>
```

Renaming a publishable package counts as adding one: the new name needs its own record.

Nothing in CI catches a missing record. The credential preflight has no credential to check in
OIDC mode, and asking npm which packages have records costs an OTP each, so no runner can
query it. Sibling repo `pie-players` closes this gap with a committed ledger of confirmed
claims (`scripts/trusted-publishers.json`, asserted by `scripts/check-trusted-publishers.mjs`
before the version bump); porting that here is worthwhile if this repo gains packages with any
regularity.

## Verifying

Take care with `--verify` as it currently stands: it reports `read ok` whenever
`npm trust list` exits 0, and npm exits 0 — printing an empty list — for a package with no
trusted publisher at all. A clean `--verify` therefore does not prove a record exists. In
`pie-players` that false green preceded a release in which 35 of 36 packages failed with
`ENEEDAUTH`; the fix there parses the JSON payload and classifies each package as configured,
wrong target, or not configured, and is worth porting alongside the ledger above.

Until then the dependable signals are:

- After a release, provenance attestations, which only the OIDC path can produce:

  ```bash
  bun run check:provenance            # defaults to the version in the workspace
  bun run check:provenance 0.1.16
  ```

  It distinguishes published-without-provenance (no trusted publisher, or a token fallback)
  from not-published-at-all (a partial release).

- Ad hoc and without any 2FA round trip, since a published version records the publisher that
  produced it:

  ```bash
  curl -s https://registry.npmjs.org/@pie-qti/theme | jq '.versions["0.1.16"]._npmUser'
  # trustedPublisher.oidcConfigId present => published via OIDC; absent => published with a token
  ```
