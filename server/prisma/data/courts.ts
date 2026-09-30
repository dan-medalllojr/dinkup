// Real pickleball venues in Metro Cebu.
//
// Only venues with a verified pin are seeded. `lat`/`lng` of null means we
// know the venue exists (from local directories) but don't have an exact
// location yet. To add one: find it on Google Maps, right-click the pin,
// copy the coordinates, paste them here, fill in the address, and set
// `source` to where you got it. Then run `npm run db:seed --workspace server`.
//
// A wrong pin sends players to the wrong place, so never guess.

export type CourtSeed = {
  slug: string;
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  courtCount?: number;
  setting?: 'indoor' | 'outdoor' | 'covered';
  notes?: string;
  source: string;
};

export const COURTS: CourtSeed[] = [
  // --- Verified pins ---------------------------------------------------
  {
    slug: 'pumpd-pickleball-cebu',
    name: 'PUMPD Pickleball Cebu',
    address: 'Cebu Prosperity Center Compound, Lopez Jaena St., Subangdaku',
    city: 'Mandaue City',
    lat: 10.324174,
    lng: 123.926787,
    setting: 'indoor',
    source: 'OpenStreetMap node/14017292781',
  },
  {
    slug: 'zions-pickleball',
    name: 'Zions Pickleball',
    address: 'Celadon Town, Pajac',
    city: 'Lapu-Lapu City',
    lat: 10.294865,
    lng: 123.983563,
    courtCount: 3,
    setting: 'covered',
    source: 'Map embedded on zionspickleball.com',
  },
  {
    slug: 'niceserve-pickleball-court',
    name: 'NiceServe Pickleball Court',
    address: 'Deca Homes 2, Soong 1, Bankal',
    city: 'Lapu-Lapu City',
    lat: 10.304404,
    lng: 123.99285,
    setting: 'outdoor',
    source: 'OpenStreetMap way/1527991387',
  },
  {
    slug: 'nickleball-avenue',
    name: 'Nickleball Avenue',
    address: 'Sitio Kasambagan Road, Lagtang',
    city: 'Talisay City',
    lat: 10.26852,
    lng: 123.836435,
    setting: 'outdoor',
    source: 'OpenStreetMap way/1537988110',
  },

  // --- Needs a pin (from cebupickleballcourts.com, cebucourtsandclubs.com, sugbo.ph) ---
  { slug: 'velocity-pickleball-hub', name: 'Velocity Pickleball Hub', address: 'Beside QC Pavilion, Gorordo Ave', city: 'Cebu City', lat: null, lng: null, source: 'velocitypickleballcebu.com' },
  { slug: 'andot-pickle-court', name: 'Andot Pickle Court', address: 'Guadalupe', city: 'Cebu City', lat: null, lng: null, courtCount: 2, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'hq-pickleball-cebu', name: 'HQ Pickleball Cebu', address: 'Archbishop Reyes Ave', city: 'Cebu City', lat: null, lng: null, notes: 'Open 24 hours', source: 'sugbo.ph' },
  { slug: 'dh-sports-hub', name: 'DH Sports Hub', address: 'Banilad', city: 'Cebu City', lat: null, lng: null, setting: 'indoor', source: 'sugbo.ph' },
  { slug: 'pino-pickleball-court', name: 'Pino Pickleball Court', address: 'San Jose Road', city: 'Cebu City', lat: null, lng: null, setting: 'outdoor', source: 'sugbo.ph' },
  { slug: 'dula-pickleball-courts', name: 'DULA Pickleball Courts Cebu', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 8, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'royall-court-sports-center', name: 'Royall Court Sports Center', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 6, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'vybe-picklehaus', name: 'VYBE Picklehaus', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 4, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'rocket-pickle-cebu', name: 'Rocket Pickle Cebu', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 5, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'side-out-pickleball-center', name: 'Side-out Pickleball Center', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 5, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'power-play-cebu', name: 'Power Play Cebu', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 5, setting: 'indoor', source: 'cebupickleballcourts.com' },
  { slug: 'pickaball-sports-center', name: 'Pickaball Sports Center', address: '', city: 'Mandaue City', lat: null, lng: null, courtCount: 7, setting: 'indoor', source: 'cebucourtsandclubs.com' },
  { slug: 'prime-rally-ph', name: 'Prime Rally PH Pickleball Court', address: '', city: 'Cebu City', lat: null, lng: null, courtCount: 9, setting: 'indoor', source: 'cebucourtsandclubs.com' },
  { slug: 'net-and-paddle-pickleball-club', name: 'Net and Paddle Pickleball Club', address: 'Sawang Calero', city: 'Talisay City', lat: null, lng: null, setting: 'indoor', source: 'sugbo.ph' },
  { slug: 'pickle-vybes', name: 'Pickle Vybes', address: '', city: 'Talisay City', lat: null, lng: null, courtCount: 11, source: 'cebucourtsandclubs.com' },
  { slug: 'picklebear-pickleball-court', name: 'PickleBear Pickleball Court', address: '', city: 'Lapu-Lapu City', lat: null, lng: null, courtCount: 5, setting: 'indoor', source: 'cebucourtsandclubs.com' },
  { slug: 'cebu-pickle-club', name: 'Cebu Pickle Club', address: '', city: 'City of Naga', lat: null, lng: null, courtCount: 10, setting: 'indoor', source: 'cebucourtsandclubs.com' },
  { slug: 'kahoy-pickleball', name: 'Kahoy Pickleball', address: '', city: 'Consolacion', lat: null, lng: null, courtCount: 4, setting: 'outdoor', source: 'cebupickleballcourts.com' },
];
