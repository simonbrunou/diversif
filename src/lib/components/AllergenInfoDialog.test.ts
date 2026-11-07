import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '../../test/component';
import AllergenInfoDialog from './AllergenInfoDialog.svelte';
import { ALLERGEN_GUIDANCE } from '#lib/content/guidance.js';
import { SOURCES } from '#lib/content/sources.js';
import { langWithin } from '../../test/source-lang';
import { ALLERGENS } from '#lib/utils/allergens.js';
import * as m from '#lib/paraglide/messages.js';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';

describe('AllergenInfoDialog', () => {
  it('does not render when allergenId is null', () => {
    const { container } = render(AllergenInfoDialog, { props: { allergenId: null } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the guidance for a known allergen', () => {
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
    expect(document.body.textContent).toMatch(/Œuf/);
    expect(screen.getByText(/Repère/)).toBeTruthy();
    expect(screen.getByText(/Comment l’introduire/)).toBeTruthy();
    expect(screen.getByText(/Premiers signes/)).toBeTruthy();
    expect(screen.getByText(/Sources/)).toBeTruthy();
  });

  // guidance.ts marks safety points as **…**: the dialog sets them in <strong>
  // and prints no marker (#668).
  it.each(ALLERGENS.map((a) => a.id))('prints no ** in the %s guidance', (allergenId) => {
    render(AllergenInfoDialog, { props: { allergenId } });
    expect(document.body.textContent).not.toContain('**');
  });

  it('sets the marked safety point of the peanut guidance in <strong>', () => {
    render(AllergenInfoDialog, { props: { allergenId: 'arachide' } });
    expect(screen.getByText('Jamais').tagName).toBe('STRONG');
  });

  // The dialog renders at <body>, under <html lang="en"> on /en pages, but its
  // guidance comes from guidance.ts, which is French only: each guidance text
  // declares lang="fr" so a screen reader doesn't read it as English, and the
  // localized labels around it keep the page's language.
  describe('on an English page', () => {
    afterEach(() => overwriteGetLocale(() => baseLocale));
    const langOf = (text: string) =>
      screen.getByText(text).closest('[lang]')?.getAttribute('lang') ?? null;

    it('tags the French guidance with lang="fr"', () => {
      overwriteGetLocale(() => 'en');
      render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
      const g = ALLERGEN_GUIDANCE.oeuf;
      const texts = [
        g.timing,
        g.why,
        ...g.howToOffer,
        ...g.firstSigns,
        ...g.severeSigns,
        g.whatToDo
      ];
      expect(texts.filter((t) => langOf(t) !== 'fr')).toEqual([]);
    });

    it('leaves the localized labels out of lang="fr"', () => {
      overwriteGetLocale(() => 'en');
      render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
      const labels = [
        m.allergenDialogSeverityMajor(),
        m.allergenDialogWhyEarlyTitle(),
        m.allergenDialogHowToOfferTitle(),
        m.allergenDialogFirstSignsTitle(),
        m.allergenDialogSevereSignsTitle(),
        m.allergenDialogSourcesTitle()
      ];
      expect(labels.filter((t) => langOf(t) === 'fr')).toEqual([]);
    });

    // The cited titles keep their own language: LEAP's is English, the
    // HCSP's French (#665). Each title must carry it inside the source list,
    // whatever the dialog wraps the list in.
    it('tags each cited title with its own language', () => {
      overwriteGetLocale(() => 'en');
      render(AllergenInfoDialog, { props: { allergenId: 'arachide' } });
      expect(ALLERGEN_GUIDANCE.arachide.sources).toEqual(
        expect.arrayContaining(['leap-2015', 'hcsp-2020'])
      );
      const leap = screen.getByText(SOURCES['leap-2015'].label);
      const list = leap.closest('ul');
      if (!list) throw new Error('the cited titles sit in no list');
      expect({
        leap: langWithin(leap, list),
        hcsp: langWithin(screen.getByText(SOURCES['hcsp-2020'].label), list)
      }).toEqual({ leap: 'en', hcsp: 'fr' });
    });
  });

  it('wraps the dialog body in a scroll container so mobile bottom-sheet content cannot clip', () => {
    // Without the max-h-[70vh] + overflow-y-auto wrapper, the why /
    // how-to-offer / first-signs / severe-signs / sources stack overflows the
    // 92dvh sheet height with no way to reach the bottom — content (and the
    // close button) become unreachable. The same pattern is used by
    // StageDetailSheet.
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
    const scroller = document.querySelector('[role="dialog"] .max-h-\\[70vh\\].overflow-y-auto');
    expect(scroller).toBeTruthy();
  });

  it('calls onclose when the Fermer button is clicked', async () => {
    const onclose = mock();
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf', onclose } });
    // Modal renders a single "Fermer" close control (top-right icon button,
    // aria-label "Fermer"); the dialog no longer adds its own footer button.
    await fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onclose).toHaveBeenCalled();
  });

  // Escape-to-close is covered by bits-ui's own test suite; the dialog now
  // wraps bits-ui DialogPrimitive whose escape handler doesn't surface through
  // happy-dom's keydown synthesis. Click-on-Fermer (the test above) is the
  // representative close path.
});
