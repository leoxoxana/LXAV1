'use strict';
const { FLAGSHIPS, pick, nameMatches } = require('./functions/radio-flagships');
describe('flagships', () => {
  test('nameMatches: whole name part only; short call letters must start the name', () => {
    expect(nameMatches('WQHT Hot 97', 'Hot 97')).toBe(true);
    expect(nameMatches('Hot 97.5 KVEG', 'Hot 97')).toBe(false);
    expect(nameMatches('Hot 970', 'Hot 97')).toBe(false);
    expect(nameMatches('KPWR 105.9', 'KPWR')).toBe(true);
    expect(nameMatches('My KPWR', 'KPWR')).toBe(false);
    expect(nameMatches('', 'Hot 97')).toBe(false);
  });
  test('pick: right country, usable stream, most clicked', () => {
    const list = [{ name: 'Hot 97', countrycode: 'US', clickcount: 5 }, { name: 'Hot 97 Clone', countrycode: 'US', clickcount: 50 }, { name: 'Hot 97', countrycode: 'DE', clickcount: 500 }, { name: 'Hot 97 Dead', countrycode: 'US', clickcount: 900, dead: true }];
    expect(pick(list, { q: 'Hot 97', cc: 'US', genre: 'hiphop' }, s => !s.dead).name).toBe('Hot 97 Clone');
    expect(pick([], { q: 'x', cc: '' }, () => true)).toBeNull();
  });
  test('the list is well formed and hip-hop / dance are well covered', () => {
    expect(FLAGSHIPS.every(e => e.q && e.genre && typeof e.cc === 'string')).toBe(true);
    expect(FLAGSHIPS.filter(e => e.genre === 'hiphop').length).toBeGreaterThanOrEqual(20);
    expect(FLAGSHIPS.filter(e => e.genre === 'dance').length).toBeGreaterThanOrEqual(20);
  });
});
