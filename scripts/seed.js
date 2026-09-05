#!/usr/bin/env node
'use strict';

// Production-safe entry point for `prisma db seed` / `npm run seed`.
//
// The production image (see Dockerfile) runs `npm prune --omit=dev` after
// building, which removes ts-node/typescript. Running `ts-node prisma/seed.ts`
// directly (the previous `prisma.seed` config) therefore fails on Railway's
// Pre-deploy command with "ts-node: not found", so the live database never
// got seeded.
//
// This wrapper prefers the compiled JavaScript output produced by
// `npm run build` (dist/prisma/seed.js) so production never needs ts-node.
// It falls back to ts-node for local development, where devDependencies are
// installed but `dist/` may not have been built yet.

const path = require('path');
const fs = require('fs');

const compiledSeedPath = path.join(__dirname, '..', 'dist', 'prisma', 'seed.js');

if (fs.existsSync(compiledSeedPath)) {
  require(compiledSeedPath);
} else {
  require('ts-node/register');
  require(path.join(__dirname, '..', 'prisma', 'seed.ts'));
}
