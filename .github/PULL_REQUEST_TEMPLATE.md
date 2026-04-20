## Summary

<!-- One paragraph. What changed and why. No bullet soup. -->

## Type of change

- [ ] `feat` — new capability
- [ ] `fix` — bug fix
- [ ] `test` — test addition or modification
- [ ] `security` — security test or hardening
- [ ] `perf` — performance improvement
- [ ] `docs` — documentation only
- [ ] `chore` — tooling, deps, config

## Scope

<!-- Which package(s) does this touch? -->
`@qrypto/`

## Test coverage

<!-- What tests cover this change? If none, explain why. -->

## Financial correctness (if applicable)

- [ ] All new financial assertions use `decimal.util.ts` — no native JS float arithmetic
- [ ] Amounts are handled as strings throughout — never coerced to `number` for arithmetic
- [ ] Fee calculations round in the correct direction (ceil for exchange, floor for user)

## Compliance impact (if applicable)

- [ ] No compliance test retries introduced — zero retries is an invariant
- [ ] BDD scope respected — only non-engineer-readable flows in compliance suite
- [ ] Any new compliance scenario reviewed against the BDD scope rule in the master prompt

## Security impact (if applicable)

- [ ] Attack vector documented in the test itself
- [ ] Expected system behaviour (block) asserted explicitly
- [ ] No external services or special tooling required to run the test

## Breaking changes

<!-- Does this change any public API, schema, or factory interface? -->
- [ ] No breaking changes
- [ ] Breaking change — described below

<!-- If breaking: what changes, what consumers are affected, migration path -->

## Checklist

- [ ] `npm run typecheck` passes across all packages
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] Commit messages follow `type(scope): description` format
- [ ] `CHANGELOG.md` updated if this is a phase completion or notable change
- [ ] New files have `Last updated:` date in their header comment
