# Contributing

Thanks for contributing to Dependency Risk Radar.

## Development setup

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

## Pull request rules

- Keep changes focused and minimal.
- Add or update tests for every behavior change.
- Do not introduce new product features unless explicitly scoped.
- Keep TypeScript strict and avoid `any` in production paths.

## Commit and PR checklist

- [ ] `corepack pnpm build` passes
- [ ] `corepack pnpm test` passes
- [ ] `corepack pnpm --dir apps/cli run pack:dry-run` passes
- [ ] docs updated if behavior changed

## Security-sensitive changes

For path handling, policy loading, and action output logic, include adversarial tests (path traversal, symlink escape, unsafe output content).
