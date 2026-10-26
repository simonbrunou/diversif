import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { fireEvent, screen } from '@testing-library/svelte';
import * as m from '#lib/paraglide/messages.js';
import { stubGlobal } from '../test/bun-test-utils';
import { isHydrated, markHydrated, recoverFromFailedBoot } from './boot-recovery';

// What Chromium rejects kit.start() with when the root layout chunk fails (DIVERSIF-D).
const ROOT_CHUNK_FAILURE = new TypeError(
  'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/0.uSiPSxcP.js'
);

const banner = () => document.querySelectorAll('[data-boot-failure]');
const stubReload = () => spyOn(location, 'reload').mockImplementation(() => {});

// Before, not after: the preload's afterEach (body, spies, stubbed globals)
// runs after this file's, so a stubbed sessionStorage would still be in place.
beforeEach(() => {
  delete document.documentElement.dataset.hydrated;
  sessionStorage.clear();
});

describe('recoverFromFailedBoot', () => {
  it('reloads once when a root chunk fails before hydration', () => {
    const reload = stubReload();

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(banner()).toHaveLength(0);
  });

  it('shows the banner instead when the reloaded page fails too', () => {
    const reload = stubReload();
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    // The reloaded page, same tab: sessionStorage survives the reload.
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain(m.errorsNetwork());
  });

  it('reloads again for a failed boot after the app has started once', () => {
    const reload = stubReload();
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);
    markHydrated();

    // A later page load in the same tab.
    delete document.documentElement.dataset.hydrated;
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).toHaveBeenCalledTimes(2);
    expect(banner()).toHaveLength(0);
  });

  it('shows the banner without reloading when the browser is offline', () => {
    const reload = stubReload();
    stubGlobal('navigator', { onLine: false });

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).not.toHaveBeenCalled();
    expect(banner()).toHaveLength(1);
  });

  it('shows the banner again when « Réessayer » fails once back online', () => {
    const reload = stubReload();
    stubGlobal('navigator', { onLine: false });
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    // The page « Réessayer » reloaded, now online.
    document.body.innerHTML = '';
    stubGlobal('navigator', { onLine: true });
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).not.toHaveBeenCalled();
    expect(banner()).toHaveLength(1);
  });

  it('never reloads without sessionStorage to guard against a loop', () => {
    const reload = stubReload();
    const denied = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    stubGlobal('sessionStorage', { getItem: denied, setItem: denied, removeItem: denied });

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);
    markHydrated();

    expect(reload).not.toHaveBeenCalled();
    expect(banner()).toHaveLength(1);
  });

  it('puts the banner first in the page and reloads when the parent presses Réessayer', async () => {
    const reload = stubReload();
    stubGlobal('navigator', { onLine: false });
    document.body.innerHTML = '<a href="#main">Aller au contenu</a><main id="main"></main>';

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);
    expect(document.body.firstElementChild?.hasAttribute('data-boot-failure')).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: m.offlineFallbackRetry() }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows a single banner however many failures follow', () => {
    stubReload();
    stubGlobal('navigator', { onLine: false });

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);
    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(banner()).toHaveLength(1);
  });

  it('leaves a hydrated app alone', () => {
    const reload = stubReload();
    markHydrated();

    recoverFromFailedBoot(ROOT_CHUNK_FAILURE);

    expect(reload).not.toHaveBeenCalled();
    expect(banner()).toHaveLength(0);
  });

  it('leaves errors that are not network failures to Sentry', () => {
    const reload = stubReload();

    recoverFromFailedBoot(new TypeError("Cannot read properties of undefined (reading 'id')"));

    expect(reload).not.toHaveBeenCalled();
    expect(banner()).toHaveLength(0);
  });
});

describe('isHydrated', () => {
  it('is false until the root layout marks the app as started', () => {
    expect(isHydrated()).toBe(false);
    markHydrated();
    expect(isHydrated()).toBe(true);
  });

  it('is false on the server, where there is no document', () => {
    stubGlobal('document', undefined);
    expect(isHydrated()).toBe(false);
  });
});
