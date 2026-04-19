## Summary

- 

## Risk and security impact

- [ ] touches path handling / filesystem boundaries
- [ ] touches policy parsing or enforcement
- [ ] touches provider/network enrichment
- [ ] touches CI/GitHub Action behavior

## Verification

- [ ] corepack pnpm build
- [ ] corepack pnpm test
- [ ] corepack pnpm --dir apps/cli run pack:dry-run
