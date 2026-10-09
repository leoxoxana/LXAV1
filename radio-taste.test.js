// The artist evidence: a mixed station ("manele" + "populara" in its tags) is promoted to MANELE only when the titles it plays over several builds are mostly manele artists.
const radio = require('./functions/radio');
const artists = require('./functions/radio-artists');

const station = (name, tags) => ({ name, tags });
const mk = (name, tags, u) => { const rec = station(name, tags), item = { n: name, u, s: radio.styleOf(rec) }; if (radio.explicitManele(rec)) item.m = 1; return { rec, item }; };
const run = async (rows, titles, previous) => {
  const stationOf = new Map(rows.map(r => [r.item, r.rec]));
  let calls = 0;
  const out = await radio.tasteStep(rows.map(r => r.item), stationOf, { previous: { taste: previous || {} }, readIcy: async () => ({ ok: true, title: titles[calls++] }) }, () => false);
  return out.ledger;
};

describe('artistIn', () => {
  test('matches names without diacritics, ignores others', () => {
    expect(artists.artistIn('Nicolae Guță - Banul, hoțul timpului')).toBe(true);
    expect(artists.artistIn('Tzancă Uraganu, Nikolas - Zeița Din Olimp')).toBe(true);
    expect(artists.artistIn('VALI VIJELIE -colaj- Si daca viata mea')).toBe(true);
    expect(artists.artistIn('Mariana Palavu - Mandră iubirea')).toBe(false);
    expect(artists.artistIn('')).toBe(false);
  });
});

describe('taste step', () => {
  const mixed = () => mk('Radio Ideal', 'dance,etno,manele,populară', 'https://x.example/ideal');

  test('three different titles, two of them manele artists, promote the station', async () => {
    const row = mixed();
    expect(radio.maneleTier(row.item)).toBeGreaterThanOrEqual(3);
    let ledger = await run([row], ['Vali Vijelie - A']);
    ledger = await run([row], ['Florin Salam - B'], ledger);
    expect(row.item.m).not.toBe(1);
    ledger = await run([row], ['Maria Popescu - C'], ledger);
    expect(ledger['x.example/ideal']).toMatchObject({ n: 3, h: 2 });
    expect(row.item.m).toBe(1);
    expect(radio.maneleTier(row.item)).toBe(2);
  });

  test('the same title again counts once', async () => {
    const row = mixed();
    let ledger = await run([row], ['Vali Vijelie - A']);
    ledger = await run([row], ['Vali Vijelie - A'], ledger);
    expect(ledger['x.example/ideal'].n).toBe(1);
  });

  test('folk titles never promote', async () => {
    const row = mixed();
    let ledger = {};
    for (const t of ['Mariana Palavu - A', 'Lena Miclaus - B', 'Fanica Luca - C', 'Mioara Velicu - D']) ledger = await run([row], [t], ledger);
    expect(row.item.m).not.toBe(1);
  });

  test('a station that does not say manele is never read', async () => {
    const row = mk('Radio Folclor', 'folclor,populara', 'https://x.example/folk');
    const ledger = await run([row], ['Vali Vijelie - A', 'Vali Vijelie - B', 'Vali Vijelie - C']);
    expect(Object.keys(ledger)).toEqual([]);
  });

  test('the owner decision for Radio Manele Petrecere stays', async () => {
    const row = mk('RADIO MANELE PETRECERE', 'manele,petrecere', 'https://x.example/petrecere');
    const ledger = await run([row], ['Florin Salam - A']);
    expect(Object.keys(ledger)).toEqual([]);
  });
});

describe('served list', () => {
  test('the artist samples never reach the players', () => {
    const out = radio.servedList({ updatedAt: 1, cats: [], taste: { a: { n: 1, h: 1, last: 'x' } }, dropped: [] }, new Set());
    expect(out.taste).toBeUndefined();
    expect(out.dropped).toBeUndefined();
  });
});
