// A `$app/forms` mock that keeps the use:enhance callback, so a component
// test can play SvelteKit's part for a dialog: run the callback, then apply a
// result through `update` (docs/agents/testing.md, « An enhanced form's
// result »). Each test file registers it before it imports its page:
//
//   const forms = captureEnhance();
//   mock.module('$app/forms', () => forms.module());

import { mock } from 'bun:test';
import { tick } from 'svelte';

type Settle = (opts: { result: { type: string }; update: () => Promise<void> }) => Promise<void>;
type Submit = (input: { cancel: () => void }) => Settle | void;

export function captureEnhance() {
  let captured: Submit | undefined;
  return {
    // applyAction and deserialize as in src/test/app-stubs.ts, so a page that
    // imports them still loads.
    module: () => ({
      enhance: (_form: HTMLFormElement, submit: Submit) => {
        captured = submit;
        return { destroy: () => {} };
      },
      applyAction: mock(() => {}),
      deserialize: mock(() => {})
    }),
    /**
     * Runs `open`, the click that mounts a dialog's form, then submits the
     * last form that registered during it and applies `result` through
     * `update`. Forms the page registered at mount are never the one
     * submitted: the call throws when `open` registered none.
     */
    async submit(
      open: () => Promise<unknown>,
      result: { type: string },
      update: () => Promise<void>
    ): Promise<void> {
      captured = undefined;
      await open();
      // `open` sets it, which TypeScript's narrowing to undefined can't see.
      const settle = (captured as Submit | undefined)?.({ cancel: () => {} });
      if (!settle) throw new Error('open() mounted no enhanced form');
      await settle({ result, update });
      await tick();
    }
  };
}
