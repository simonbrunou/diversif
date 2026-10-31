import { describe, expect, it } from 'bun:test';
import { withFallbackTitle } from './document-title.js';

const APP_TITLE = '<title>Diversif · Diversification alimentaire bébé</title>';

describe('withFallbackTitle', () => {
  it('adds the app-wide title to a head without one', () => {
    expect(withFallbackTitle('<head><meta charset="utf-8" /></head><body>x</body>')).toBe(
      `<head><meta charset="utf-8" />${APP_TITLE}</head><body>x</body>`
    );
  });

  it("leaves a page's own title alone", () => {
    const html = '<head><title>Connexion</title></head><body>x</body>';
    expect(withFallbackTitle(html)).toBe(html);
  });

  it('passes a chunk without the end of the head through', () => {
    const html = '<body>x</body></html>';
    expect(withFallbackTitle(html)).toBe(html);
  });

  it('does not count a comment in the head that names the <title> element', () => {
    expect(withFallbackTitle('<head><!-- no <title> here --></head><body>x</body>')).toBe(
      `<head><!-- no <title> here -->${APP_TITLE}</head><body>x</body>`
    );
  });

  it('does not count a <title> in the body', () => {
    expect(withFallbackTitle('<head></head><body><svg><title>Logo</title></svg></body>')).toBe(
      `<head>${APP_TITLE}</head><body><svg><title>Logo</title></svg></body>`
    );
  });
});
