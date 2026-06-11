#!/usr/bin/env bun
// Compiles the paraglide runtime for the non-vite consumers (svelte-check,
// lint:i18n, bun test) using the SAME options object as the vite plugin —
// see paraglide.config.ts for why drift between the two would be a bug.
process.env.INLANG_TELEMETRY = 'false';

import { compile } from '@inlang/paraglide-js';
import { paraglideCompilerOptions } from '../paraglide.config';

await compile(paraglideCompilerOptions);
