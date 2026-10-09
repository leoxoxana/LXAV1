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

describe('trap style needs the word manele', () => {
  test('indie electronic / a plain dj radio are not trap manele; a trap station that says manele is', () => {
    expect(radio.styleOf({ name: 'Clasic Radio_Indie', tags: 'experimental,indie electronic,indie folk' })).not.toContain('trap');
    expect(radio.styleOf({ name: 'Center Deejay Brașov -DJ Radio', tags: 'dance,petrecere' })).not.toContain('trap');
    expect(radio.styleOf({ name: 'Ade FM', tags: 'hip-hop,manele,rap,trap' })).toContain('trap');
    expect(radio.styleOf({ name: 'Trapanele Radio', tags: '' })).toContain('trap');
  });
  test('owner list: stations heard playing other music are kept out of MANELE', () => {
    expect(radio.OWNER_NOT_MANELE.test('DejaVuMusic -Radio DejaVu')).toBe(true);
    expect(radio.OWNER_NOT_MANELE.test('Clasic Radio_Indie -București')).toBe(true);
    expect(radio.OWNER_NOT_MANELE.test('Super Manele')).toBe(false);
  });
});

describe('"manea" is a word, not a piece of "romaneasca"', () => {
  test('Romanian light-music stations are not manele', () => {
    expect(radio.explicitManele({ name: 'Radio Valori Românești', tags: 'muzica usoara romaneasca' })).toBe(false);
    expect(radio.explicitManele({ name: 'Clasic Radio_100% Romanesc', tags: 'muzica usoara romaneasca,pop' })).toBe(false);
    expect(radio.inCategory(radio.CATEGORIES[0], { name: 'Radio Liberty Muzică Românească', tags: '90s,hits,muzica usoara romaneasca' })).toBe(false);
  });
  test('real manele spellings still count', () => {
    expect(radio.explicitManele({ name: 'Manea FM', tags: '' })).toBe(true);
    expect(radio.explicitManele({ name: 'X', tags: 'manele' })).toBe(true);
    expect(radio.explicitManele({ name: 'ManeleLive', tags: '' })).toBe(true);
  });
});

describe('owner decision: Radio Manele Petrecere is listed in ETNO', () => {
  test('not manele, tier 4 (ETNO)', () => {
    const st = { name: 'RADIO MANELE PETRECERE', tags: 'manele,petrecere' };
    expect(radio.explicitManele(st)).toBe(false);
    expect(radio.styleOf(st)).toEqual(['etno']);
    expect(radio.maneleTier({ s: radio.styleOf(st) })).toBeGreaterThanOrEqual(3);
    expect(radio.explicitManele({ name: 'Radio Manele Petrecere Plus', tags: 'manele' })).toBe(true);
  });
});
