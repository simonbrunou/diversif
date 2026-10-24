import { describe, mock } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import { itShowsActionMessagesInline } from '../../../test/action-messages';

mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/password') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page renders its result inline; a toast would show it a second time.
const toast = { error: mock(), success: mock() };
mock.module('svelte-sonner', () => ({ toast }));

import type { ActionData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

describe('account/password page', () => {
  itShowsActionMessagesInline({
    renderPage: (form) => render(Page, { props: { form: form as ActionData } }),
    toast,
    refusal: {
      form: { passwordErrorKey: 'errorsAccountPasswordIncorrect' },
      text: 'Mot de passe actuel incorrect.'
    },
    success: {
      form: { passwordSuccessKey: 'errorsAccountPasswordSuccess' },
      text: 'Mot de passe modifié.'
    }
  });
});
