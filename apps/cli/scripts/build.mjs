import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const distDir = path.join(packageRoot, 'dist');
const entryPoint = path.join(packageRoot, 'src', 'cli.ts');
const outfile = path.join(distDir, 'cli.cjs');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node20'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  legalComments: 'none',
  sourcemap: false,
  sourcesContent: false,
  external: ['commander'],
});
