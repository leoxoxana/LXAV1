'use strict';
// MANELE PICKS: manele stations whose https address the directory does not carry (its entry is plain http, which a https page cannot play) but that the same hosting company serves over https
// (the same port behind the hosting gateway). Every one was checked by hand: the stream's own name (icy-name) is the station ("Radio Manele Romania wWw.FMRadioManele.Ro", "Capital FM Manele", ...)
// and the song titles it sent were manele (Liviu Pustiu, Carmen de la Salciua, Costel Biju, Danny, Florin Salam ...). They are fed to the normal MANELE pipeline as candidates: the usual probe (server + phone)
// decides every build, a dead one is dropped silently, a duplicate of a station that is already there is ignored, and the owner's hide / move list still applies.
// votes = the directory's votes of the station (only used to rank it among the others).
const PICKS = [
  { n: 'Radio Manele Romania - FMRadioManele.Ro', u: 'https://ssl.servereradio.ro/8054/stream', votes: 2059 },
  { n: 'Radio Tequila Manele Romania', u: 'https://ssl.servereradio.ro/7000/stream', votes: 1222 },
  { n: 'Capital FM Manele', u: 'https://ssl.omegahost.ro/8020/stream', votes: 444 },
  { n: 'Radio Doza Manele', u: 'https://radio.sonicpanel.ro/8100/stream', votes: 384 },
  { n: 'Radio A-Tentat', u: 'https://ssl.omegahost.ro/8066/stream', votes: 43 },
  { n: 'Radio NebunYa Manele', u: 'https://ssl.servereradio.ro/7575/stream', votes: 11 }
];

// directory-shaped records, so the pipeline treats them like any other candidate
const records = () => PICKS.map(p => ({ name: p.n, url: p.u, url_resolved: p.u, tags: 'manele', codec: 'MP3', bitrate: 128, countrycode: 'RO', lastcheckok: 1, hls: 0, votes: p.votes, clickcount: 0, stationuuid: 'pick:' + p.u }));

module.exports = { PICKS, records };
