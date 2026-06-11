/**
 * Detects the Playwright end-to-end server, and ONLY it.
 *
 * E2E=1 alone is not enough: the e2e webServer deliberately runs the
 * production build with NODE_ENV=production (playwright.config.ts), so a
 * NODE_ENV check can't distinguish e2e from a real deployment — and a stray
 * E2E=1 in a production environment must not weaken the argon2id cost or the
 * signup throttle. The discriminating signal is ORIGIN: the e2e webServer
 * always sets ORIGIN=http://localhost:<port> on its command line, while a
 * real deployment either leaves ORIGIN unset (the Docker image derives the
 * origin per-request from PROTOCOL_HEADER/HOST_HEADER) or sets it to an
 * https:// public hostname. Requiring BOTH E2E=1 AND a plain-http loopback
 * ORIGIN makes the relaxations inert anywhere that serves real traffic.
 */
export function isE2E(): boolean {
  if (process.env.E2E !== '1') return false;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.ORIGIN ?? '');
}
