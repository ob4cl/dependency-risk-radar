# dradar

`apps/cli` is the npm-packable CLI package for Dependency Risk Radar.

Package name today: `dradar`
Binary name: `radar`

## Local dev

From the repo root:

```bash
corepack enable
corepack pnpm install
corepack pnpm analyze -- --repo . --base main --head HEAD
```

Or run the CLI directly from the workspace:

```bash
tsx apps/cli/src/cli.ts analyze --repo . --base main --head HEAD
```

## Pack flow

Use `npm pack` to inspect what would be shipped to the registry.

```bash
cd apps/cli
npm pack --dry-run --json
npm pack
```

The dry run is the fastest way to verify the release surface before you publish:

- check the tarball file list
- confirm the package name and version
- confirm the binary path is what you expect
- catch accidental files before they reach npm

The publish build is designed to ship `dist/` only. Before a real publish, verify that the installed package contains runnable JavaScript for the `radar` binary and not source TypeScript.

Inspect a generated tarball with:

```bash
tar -tf dradar-0.1.1.tgz
```

## Release flow

The package-level release helper scripts live here:

- `npm run release:check` (build + pack dry-run)
- `npm run release:publish`
- `npm run release:version:patch`
- `npm run release:version:minor`
- `npm run release:version:major`

## Publish checklist

Before the first real publish, make sure all of these are true:

- You own or administer the npm scope/name you plan to publish under
- `npm whoami` works after `npm login`
- The package version has been bumped to the intended release number
- The tarball contains the files needed to run the CLI after install
- CI, if used, has an npm automation token with publish rights
- The token is injected as `NPM_TOKEN` and wired into `.npmrc`

Typical publish command:

```bash
npm publish --access public
```

If this package is meant to stay private on npm, publish with the access level you actually want and verify the scope policy before release.

## Repo layout note

This package currently depends on workspace packages in the monorepo. That is fine for local development and pack inspection. Do not treat the repo checkout itself as the publish artifact; the published package should be validated from the tarball created by `npm pack`.
