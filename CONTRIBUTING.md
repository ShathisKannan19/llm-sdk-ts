# Contributing

Thanks for helping improve **llm-sdk-ts**.

## Development setup

```bash
npm install        # also wires the git hooks (see below)
npm run verify     # typecheck + tests + build, the same gate CI runs
```

Individual scripts: `npm run typecheck` (strict `tsc` over `src` and `tests`),
`npm test` (keyless suite), `npm run build`.

`npm run check:live` (script at `scripts/live-check.ts`) hits real provider APIs
and is only for local verification when you have keys in `.env`. It is
intentionally outside `tests/` (the test runner never picks it up) and outside
`tsconfig.check.json` (CI never typechecks or runs it). Never commit `.env`.

### Git hooks

`npm install` runs the `prepare` script, which points git at `.githooks/`:

| Hook         | Runs                                                    |
| ------------ | ------------------------------------------------------ |
| `pre-commit` | `typecheck`, `test`, and — when `package.json` is staged — a `package-lock.json` sync check |
| `pre-push`   | `build` + `npm pack --dry-run`                        |

Quiet on success; full output on failure. Bypass with `git commit --no-verify` /
`git push --no-verify` only when you truly must.

## Pull requests

- Branch from `develop`; open the PR with **base = `develop`**.
- Keep PRs focused and small; they are squash-merged (one Conventional Commit).
- Add or update tests for any behaviour change.
- Run `npm run verify` (or let the hooks do it) and make sure CI is green.
- Add a line under `## [Unreleased]` in `CHANGELOG.md`.
- Commit prefix drives the version bump at release time — `fix:`/`docs:`/`chore:`
  = patch, `feat:` = minor, `feat!:` or a `BREAKING CHANGE:` footer = major.

## Code standards

- TypeScript strict mode; no implicit `any`.
- Validate all external input with Zod.
- Never log secrets.
- Keep the core provider-agnostic — provider specifics live in
  `src/llm/providers/*` behind the `ProviderCreator` interface.

## Branch model

| Branch           | Base      | Into      | Purpose                                     |
| ---------------- | --------- | --------- | ------------------------------------------ |
| `main`           | —         | —         | Released, stable. Protected. Tagged `vX.Y.Z`. |
| `develop`        | `main`    | `main`    | Integration branch; base for every PR.     |
| `feature/<slug>` | `develop` | `develop` | New capability or enhancement.             |
| `fix/<slug>`     | `develop` | `develop` | Bug fix.                                   |
| `docs/<slug>`    | `develop` | `develop` | Docs-only change.                          |
| `chore/<slug>`   | `develop` | `develop` | Tooling / deps / refactor.                 |

```bash
git checkout develop && git pull
git checkout -b feature/my-change
# ...commit...  then open a PR with base = develop
```

A release is just a version bump merged to `main`: the workflow then publishes to
npm and creates the tag and GitHub Release automatically — no `git tag`, no
Releases UI. The full ruleset (branching, SemVer bump rules, release runbook,
first-release bootstrap) is in **[RELEASING.md](RELEASING.md)**.

## Reporting security issues

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
