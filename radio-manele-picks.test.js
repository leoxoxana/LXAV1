const picks = require('./functions/radio-manele-picks');
const radio = require('./functions/radio');

describe('manele picks', () => {
  test('every pick is a https MP3 manele station the pipeline accepts', () => {
    expect(picks.PICKS.length).toBeGreaterThanOrEqual(5);
    for (const rec of picks.records()) {
      expect(radio.usable(rec)).toBe(true);
      expect(radio.explicitManele(rec)).toBe(true);
      expect(radio.topCategories(rec)).toContain('manele');
    }
  });
  test('no duplicate addresses', () => {
    const urls = picks.PICKS.map(p => p.u);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
