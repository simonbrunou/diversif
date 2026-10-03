// Registers the happy-dom globals in a preload of its own, listed before
// bunfig.preload.ts in bunfig.toml. ESM imports are hoisted, so a register()
// call inside bunfig.preload.ts runs after that file's imports — and
// @testing-library/jest-dom 7 imports @testing-library/dom, whose `screen`
// binds to document.body at module load and throws on every query when no
// document exists yet.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// A real base URL matters since paraglide 2.x: localizeHref() resolves
// against window.location.href, and `new URL(path, 'about:blank')` throws.
GlobalRegistrator.register({ url: 'http://localhost/' });
