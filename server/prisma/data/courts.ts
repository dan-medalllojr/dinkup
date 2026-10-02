// Real pickleball venues in Metro Cebu.
//
// Only venues with a verified pin are seeded. `lat`/`lng` of null means we
// know the venue exists (from local directories) but don't have an exact
// location yet. To add one: find it on Google Maps, right-click the pin,
// copy the coordinates, paste them here, fill in the address, and set
// `source` to where you got it. Check the pin with a reverse geocode (it
// should land on the stated street). Then run `npm run db:seed --workspace server`.
//
// A wrong pin sends players to the wrong place, so never guess.
// See docs/log/change-3-court-pins.md for how the current pins were checked.

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

  // Pinned 2026-10-01. Each pin is the venue's own Google Maps place (read
  // from the map a directory or the venue embeds for it, matched by place ID)
  // or the venue's website, then reverse-geocoded with Nominatim to confirm
  // it lands on the stated street. Court counts are left out where sources
  // disagree. cebucourtsandclubs.com pins were NOT used: several are 0.6–4 km off.
  {
    slug: 'velocity-pickleball-hub',
    name: 'Velocity Pickleball Hub',
    address: 'Beside QC Pavilion, Gorordo Ave, Camputhaw',
    city: 'Cebu City',
    lat: 10.31675,
    lng: 123.900069,
    courtCount: 6,
    source: 'velocitypickleballcebu.com (geo tags and map embed)',
  },
  {
    slug: 'andot-pickle-court',
    name: 'Andot Pickle Court',
    address: '38-B Jade St., Buena Hills, Guadalupe',
    city: 'Cebu City',
    lat: 10.324376,
    lng: 123.878696,
    courtCount: 2,
    setting: 'indoor',
    source: 'Google place 0x33a99ff2a1a48147:0xd8fb8ec2073d1040 via cebupickleballcourts.com embed',
  },
  {
    slug: 'hq-pickleball-cebu',
    name: 'HQ Pickleball Cebu',
    address: 'Archbishop Reyes Ave, Luz (near Cebu Grand Convention Center)',
    city: 'Cebu City',
    lat: 10.32261,
    lng: 123.90497,
    notes: 'Open 24 hours',
    source: 'Google place 0x33a9990073a4f4e5:0x25509f6bd3e161 via cebupickleballcourts.com embed',
  },
  {
    slug: 'dh-sports-hub',
    name: 'DH Sports Hub',
    address: 'The Crossroads, Gov. M. Cuenco Ave, Banilad',
    city: 'Cebu City',
    lat: 10.328158,
    lng: 123.910266,
    setting: 'indoor',
    notes: 'Wood floor, shared with other sports',
    source: 'Google place 0x33a999006c98f095:0x78e6eb45bf6fde4 via cebupickleballcourts.com embed',
  },
  {
    slug: 'prime-rally-ph',
    name: 'Prime Rally PH Pickleball Court',
    address: '1221 L. Gabuya St, Cogon Pardo',
    city: 'Cebu City',
    lat: 10.276796,
    lng: 123.862174,
    setting: 'indoor',
    source: 'Google place 0x33a99d0018c1498f:0xc1bc145c5836d83 via pickleboard.co',
  },
  {
    slug: 'net-and-paddle-pickleball-club',
    name: 'Net and Paddle Pickleball Club',
    address: '101 Tupas St., Sawang Calero',
    city: 'Cebu City',
    lat: 10.292041,
    lng: 123.889195,
    courtCount: 8,
    setting: 'covered',
    source: 'Google place 0x33a99b00324db191:0x5868c168c5f81705',
  },
  {
    slug: 'dula-pickleball-courts',
    name: 'DULA Pickleball Courts Cebu',
    address: 'F.E. Zuellig Ave (beside 2GO Express)',
    city: 'Mandaue City',
    lat: 10.314812,
    lng: 123.928863,
    courtCount: 8,
    setting: 'indoor',
    source: 'Google place 0x33a9990022920405:0xf95bd0b2ce6ec49b via cebupickleballcourts.com embed',
  },
  {
    slug: 'royall-court-sports-center',
    name: 'Royall Court Sports Center',
    address: 'E.O. Perez St, Subangdaku',
    city: 'Mandaue City',
    lat: 10.321009,
    lng: 123.927734,
    courtCount: 6,
    setting: 'indoor',
    source: 'Google place 0x33a999004b957255:0x6f32764a8c0c830b via cebupickleballcourts.com embed',
  },
  {
    slug: 'rocket-pickle-cebu',
    name: 'Rocket Pickle Cebu',
    address: '8 Block 4, North Reclamation, Subangdaku',
    city: 'Mandaue City',
    lat: 10.32016,
    lng: 123.927007,
    courtCount: 5,
    setting: 'indoor',
    source: 'Google place 0x33a999a5beff16c9:0x475dba53818bc901 via cebupickleballcourts.com embed',
  },
  {
    slug: 'pickaball-sports-center',
    name: 'Pickaball Sports Center',
    address: 'PC Street, Tabok',
    city: 'Mandaue City',
    lat: 10.344684,
    lng: 123.945003,
    courtCount: 7,
    setting: 'indoor',
    source: 'Google place 0x33a9990048c34d9f:0x6b78c93b2a4911f7 via pickleboard.co',
  },
  {
    slug: 'power-play-cebu',
    name: 'Power Play Cebu',
    address: 'P. Sanchez St, Pagsabungan',
    city: 'Mandaue City',
    lat: 10.355864,
    lng: 123.946096,
    courtCount: 5,
    setting: 'indoor',
    source: 'Google Maps place via cebupickleballcourts.com embed',
  },
  {
    slug: 'vybe-picklehaus',
    name: 'VYBE Picklehaus',
    address: 'B. Suico St, Tingub',
    city: 'Mandaue City',
    lat: 10.357991,
    lng: 123.934697,
    courtCount: 4,
    setting: 'indoor',
    source: 'Google place 0x33a9990011fcd69b:0x114ecf4d7a27385 via cebupickleballcourts.com embed',
  },
  {
    slug: 'side-out-pickleball-center',
    name: 'Side-out Pickleball Center',
    address: 'H. Abellana St, Pagsabungan',
    city: 'Mandaue City',
    lat: 10.364435,
    lng: 123.944361,
    courtCount: 5,
    setting: 'indoor',
    source: 'Google place 0x33a9998d1cd0302d:0xf853f08d898f2772 via cebupickleballcourts.com embed',
  },
  {
    slug: 'kahoy-pickleball',
    name: 'Kahoy Pickleball',
    address: 'Diversion Road, Tilhaong (next to Kahoy Cafe)',
    city: 'Consolacion',
    lat: 10.39681,
    lng: 123.958438,
    courtCount: 4,
    setting: 'outdoor',
    source: 'Google place 0x33a9a300018d1d53:0xc97813e984317006 via cebupickleballcourts.com embed',
  },
  {
    slug: 'picklebear-pickleball-court',
    name: 'PickleBear Pickleball Court',
    address: 'Mactan Airport Rd, Bankal',
    city: 'Lapu-Lapu City',
    lat: 10.310236,
    lng: 123.997635,
    courtCount: 5,
    setting: 'indoor',
    source: 'Google place 0x33a99741673f6497:0x9d8368a657a26dd9',
  },
  {
    slug: 'pickle-vybes',
    name: 'Pickle Vybes',
    address: 'Sitio Cainta, Cong. A. Bacaltos Rd, Pooc',
    city: 'Talisay City',
    lat: 10.246518,
    lng: 123.824602,
    courtCount: 11,
    source: 'Google place 0x33a99d99e2133f99:0x1c989747205744de',
  },
  {
    slug: 'cebu-pickle-club',
    name: 'Cebu Pickle Club',
    address: 'Lot 20, Naga–Toledo Rd',
    city: 'City of Naga',
    lat: 10.223317,
    lng: 123.733467,
    courtCount: 10,
    setting: 'indoor',
    source: 'Google place 0x33a97900244703f9:0x3bfa1ef222543549',
  },

  {
    // Formerly "Pino Pickleball Courts" (Pino Talamban). Pinned 2026-10-02:
    // the operator's booking site lists Pickleball Courts 1–9 under ML
    // Lifestyle Park, and Reclub meets for "Pino Pickleball Courts" link this
    // exact point and the same Google place.
    slug: 'ml-lifestyle-park',
    name: 'ML Lifestyle Park (Pino Pickleball)',
    address: 'San Jose Road, San Jose, Talamban',
    city: 'Cebu City',
    lat: 10.376937,
    lng: 123.91863,
    courtCount: 9,
    setting: 'outdoor',
    notes: 'Also basketball and futsal. Book at webpos.lavielifestyle.ph',
    source: 'Google place 0x33a9a3005f223b37:0x81add94536149007; same point on reclub.co Pino meets; operator site webpos.lavielifestyle.ph',
  },
];
