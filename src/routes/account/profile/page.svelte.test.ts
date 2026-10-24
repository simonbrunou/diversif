import { describe, mock } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import { itShowsActionMessagesInline } from '../../../test/action-messages';

mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/profile') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page renders its result inline; a toast would show it a second time.
const toast = { error: mock(), success: mock() };
mock.module('svelte-sonner', () => ({ toast }));

import type { ActionData, PageData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

const data = { user: { displayName: 'Camille' } } as unknown as PageData;

describe('account/profile page', () => {
  itShowsActionMessagesInline({
    renderPage: (form) => render(Page, { props: { data, form: form as ActionData } }),
    toast,
    refusal: {
      form: { profileErrorKey: 'errorsAccountProfileNameInvalid' },
      text: 'Nom invalide.'
    },
    success: {
      form: { profileSuccessKey: 'errorsAccountProfileSuccess' },
      text: 'Profil mis à jour.'
    }
  });
});
