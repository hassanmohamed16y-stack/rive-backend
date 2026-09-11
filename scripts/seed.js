#!/usr/bin/env node
'use strict';

// Entry point for `prisma db seed` / `npm run seed`.
//
// Uses the compiled JavaScript output in `dist/prisma/seed.js` when available
// so production runs without `ts-node`. Falls back to `ts-node` for local dev.

const path = require('path');
const fs = require('fs');

const compiledSeedPath = path.join(__dirname, '..', 'dist', 'prisma', 'seed.js');

if (fs.existsSync(compiledSeedPath)) {
  require(compiledSeedPath);
} else {
  require('ts-node/register');
  require(path.join(__dirname, '..', 'prisma', 'seed.ts'));
}
