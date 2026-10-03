#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const compiledPath = path.join(__dirname, '..', 'dist', 'scripts', 'disable-2fa.js');

if (fs.existsSync(compiledPath)) {
  require(compiledPath);
} else {
  require('ts-node/register');
  require(path.join(__dirname, 'disable-2fa.ts'));
}
