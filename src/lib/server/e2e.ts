/**
 * Detects the Playwright end-to-end server, and ONLY it.
 *
 * E2E=1 alone is not enough: the e2e webServer deliberately runs the
 * production build with NODE_ENV=production (playwright.config.ts), so a
 * NODE_ENV check can't distinguish e2e from a real deployment — and a stray
 * E2E=1 in a production environment must not weaken the argon2id cost or the
 * signup throttle. The discriminating signal is the origin the build serves
 * (__BUILD_ORIGIN__, ORIGIN at build time): the e2e webServer builds with
 * ORIGIN=http://localhost:<port>, while a real deployment builds without it
 * and derives the origin from PROTOCOL_HEADER/HOST_HEADER behind the proxy. A
 * loopback build pins SvelteKit's paths.origin, so it rejects every real
 * cross-host form POST: requiring BOTH E2E=1 AND a plain-http loopback build
 * origin makes the relaxations inert anywhere that serves real traffic. The
 * runtime ORIGIN variable is not read: adapter-node 6 ignores it, so it no
 * longer says anything about the traffic a server accepts.
 */
export function isE2E(): boolean {
  if (process.env.E2E !== '1') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(__BUILD_ORIGIN__);
}
