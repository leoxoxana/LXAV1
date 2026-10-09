'use strict';
// MANELE ARTISTS: the owner's list (generation of gold + new school) plus artists heard on the streams. Used as EVIDENCE only: a station that says "manele" in its tags but also "populara" / "folclor" /
// "etno" is a mixed station; it is listed in MANELE only when the titles it plays over several builds are mostly these artists (see tasteStep in radio.js). Names are matched without diacritics.
const ARTISTS = [
  'florin salam', 'nicolae guta', 'liviu guta', 'adrian minune', 'adrian copilul minune', 'vali vijelie', 'jean de la craiova', 'adi de la valcea', 'costi ionita', 'carmen serban', 'stana izbasa',
  'tzanca uraganu', 'bogdan de la ploiesti', 'bogdan dlp', 'luis gabriel', 'jador', 'babasha', 'dani mocanu', 'iuly neamtu', 'costel biju',
  'mihaita piticu', 'don genove', 'liviu pustiu', 'sorinel pustiu', 'carmen de la salciua', 'florin cercel', 'sorin copilul de aur', 'copilul de aur', 'dorel de la popesti', 'culita sterp',
  'vladut lacatus', 'dan armeanu', 'tavi clonda', 'denis ramniceanu', 'nicolae guta'
];
const norm = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const padded = ARTISTS.map(name => ' ' + norm(name) + ' ');
// does this title (the song that plays now) name one of the artists?
const artistIn = title => { const text = ' ' + norm(title) + ' '; return padded.some(name => text.includes(name)); };
module.exports = { ARTISTS, artistIn, norm };
