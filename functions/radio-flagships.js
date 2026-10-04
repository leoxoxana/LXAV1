'use strict';
// FLAGSHIP STATIONS for the GLOBAL list: well-known, professional stations (the radio brands everybody knows) per genre.
// WHY: the directory's click counter cannot tell "top and professional" - Hot 97 (New York) has 16 clicks there, a German remix playlist has 183 - so the data alone puts spam above the real brands.
// This file holds only NAMES (no addresses): each one is looked up in the directory at build time, accepted only if the station really plays (the usual probe) and dropped silently when it is not there,
// when its stream is not https MP3 / AAC, or when it is broken. The list is a choice made from general knowledge of the radio market (NOT a measured audience ranking); extend or correct it freely.
// q = what the station name must START with (letters and digits only, case ignored), cc = its country (empty = any), genre = the GLOBAL family it counts for (see GLOBAL_GENRES in radio.js).
const E = (genre, cc, ...names) => names.map(q => ({ q, cc, genre }));
const FLAGSHIPS = [
  ...E('hiphop', 'US', 'Hot 97', 'WQHT', 'Power 106', 'KPWR', 'Power 105', '105.1 The Beat', 'KBXX', 'Real 92.3', 'Streetz', 'V-103', '92Q', 'Hot 108', 'The Box', 'Hip Hop Nation', 'Shade 45', 'KDAY', 'Beat 102', 'Hot 107.9', 'Trap Radio', 'West Coast', 'All Underground'),
  ...E('hiphop', 'GB', 'Capital XTRA', 'BBC Radio 1Xtra', 'Rinse FM', 'Reprezent', 'Kiss Fresh'),
  ...E('dance', '', 'Proton Radio', 'Ibiza Global Radio', 'Tomorrowland One World', 'Insomniac Radio', 'Techno4ever', 'Frisky Radio', 'Afterhours', 'Cosmos Radio', 'Intense Radio', 'Trance Channel', 'TranceBase', 'Pure Trance', 'Deep House Lounge', 'Ibiza Sonica', 'Nightride', 'Defected', 'Ministry of Sound', 'Radio Record', 'Sunshine Live', 'Radio FG'),
  ...E('dance', 'GB', 'Capital Dance', 'Heart Dance', 'Kiss Dance', 'BBC Radio 1 Dance'),
  ...E('dance', 'US', 'SomaFM Beat Blender', 'SomaFM The Trip', 'SomaFM Dub Step Beyond', 'SomaFM DEF CON'),
  ...E('pop', 'US', 'Z100', 'KIIS', 'Radio Disney', 'Mix 104.1', 'Y100', 'Power 96.1', 'Q102'),
  ...E('pop', 'GB', 'Capital FM', 'Capital UK', 'Hits Radio', 'Kiss FM', 'Virgin Radio UK', 'Heart UK', 'Heart London'),
  ...E('rock', 'GB', 'Planet Rock', 'Absolute Radio Rock', 'Radio X', 'Kerrang', 'Absolute Radio'),
  ...E('rock', 'US', 'KROQ', 'Q104.3', 'WXRT', 'Classic Rock Florida', '181.FM Rock', 'Metal Nation', 'Metal Only', 'KNAC'),
  ...E('country', 'US', 'WSM', 'The Wolf', 'Country 102', 'Nash FM', 'America\'s Country', 'Outlaw Country'),
  ...E('country', 'CA', 'Country 105', 'Country 95'),
  ...E('jazz', 'GB', 'Jazz FM', 'Classic FM', 'Scala Radio'),
  ...E('jazz', 'US', 'KJAZZ', 'WBGO', 'Smooth Jazz', 'Jazz24', 'KUSC', 'Classical KING', 'WQXR', 'Jazz 88', 'Radio Swiss Jazz'),
  ...E('world', 'JM', 'Irie FM', 'Zip FM', 'Hot 102', 'Power 106 Jamaica', 'Reggae 141'),
  ...E('world', 'NG', 'Cool FM', 'Soundcity'),   // (news / talk stations of Lagos are NOT here: that was the METRO FM LAGOS mistake)
  ...E('world', 'KE', 'Capital FM Kenya', 'Kiss 100', 'Homeboyz'),
  ...E('world', 'GH', 'Joy FM', 'Choice FM'),
  ...E('world', 'ZA', 'Metro FM', '5FM', 'Y FM', 'Kfm'),
  ...E('world', 'US', 'La Mega', 'La Kalle', 'Z 92', 'Salsa', 'SomaFM Heavyweight Reggae', 'Radio Paradise', 'KEXP'),
  ...E('soul', 'GB', 'Mi-Soul', 'Solar Radio', 'Smooth R&B'),
  ...E('soul', 'US', 'WBLS', 'Radio Motown', 'Funky Corner', 'Soul Groove', 'Smooth R&B'),
  ...E('retro', 'GB', 'Absolute Radio 80s', 'Absolute Radio 90s', 'Greatest Hits Radio', 'Smooth Radio', 'Magic Radio', 'Gold', 'Heart 80s', 'Heart 90s', 'Heart 70s'),
  ...E('retro', 'US', 'WCBS', '1 HITS 80s', 'Classic Hits 109', 'Real Oldies'),
  ...E('chill', '', 'Chillout Ibiza', 'Lush', 'Drone Zone', 'Cafe del Mar', 'Chillhop', 'SomaFM Groove Salad', 'SomaFM Space Station', 'KCRW')
];
const norm = text => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const escapeRe = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// does the station name contain the query as a WHOLE name part: "Hot 97" is in "WQHT Hot 97" but not in "Hot 97.5 KVEG" or "Hot 970"; very short queries (call letters) must start the name
function nameMatches(name, query) {
  const q = String(query || '').trim(); if (!q) return false;
  const re = new RegExp('(^|[^a-z0-9])' + escapeRe(q).replace(/\s+/g, '[\\s._-]*') + '(?![0-9]|\\.[0-9])(?![a-z])', 'i');
  return norm(q).length <= 4 ? norm(name).startsWith(norm(q)) : re.test(String(name || ''));
}
// the best directory record for one entry: the name contains the query, the country matches when given, the stream is usable; the most clicked wins
function pick(list, entry, usable) {
  const found = (Array.isArray(list) ? list : []).filter(s => nameMatches(s.name, entry.q) && (!entry.cc || String(s.countrycode || '').toUpperCase() === entry.cc) && usable(s));
  return found.sort((a, b) => (Number(b.clickcount) || 0) - (Number(a.clickcount) || 0))[0] || null;
}
exports.FLAGSHIPS = FLAGSHIPS; exports.pick = pick; exports.norm = norm; exports.nameMatches = nameMatches;
