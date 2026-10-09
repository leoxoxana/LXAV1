// A station that only TAGS itself "manele" but also "populara" / "folclor" is not listed as manele (it goes to ETNO).
const radio = require('./functions/radio');

describe('explicitManele', () => {
  test('tag manele alone counts', () => {
    expect(radio.explicitManele({ name: 'Stil Mix', tags: 'manele' })).toBe(true);
  });
  test('tags manele + populara do not count, without manele in the name', () => {
    expect(radio.explicitManele({ name: 'Leordeni Fm', tags: 'manele,petrecere,populară' })).toBe(false);
    expect(radio.explicitManele({ name: 'DaciaProArgeș', tags: 'manele,petrecere,populară' })).toBe(false);
    expect(radio.explicitManele({ name: 'Radio X', tags: 'dance,manele,folclor' })).toBe(false);
  });
  test('the name saying manele always counts', () => {
    expect(radio.explicitManele({ name: 'Luduș Manele', tags: 'dance,manele,petrecere,populară' })).toBe(true);
    expect(radio.explicitManele({ name: 'Trapanele Radio', tags: '' })).toBe(true);
  });
  test('such a station falls to tier 3 (ETNO), a real one stays in manele', () => {
    const tier = (name, tags) => { const st = { name, tags }; return radio.maneleTier(radio.explicitManele(st) ? { m: 1 } : {}); };
    expect(tier('Leordeni Fm', 'manele,petrecere,populară')).toBeGreaterThanOrEqual(3);
    expect(tier('Super Manele', 'manele')).toBe(2);
  });
});
