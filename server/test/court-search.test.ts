import { describe, expect, it } from 'vitest';
import { matchCourts } from '@dinkup/shared';

const court = (name: string, address = '', city = '') => ({ name, address, city });
const COURTS = [
  court('DULA Pickleball Courts Cebu', 'F.E. Zuellig Ave', 'Mandaue City'),
  court('Pickaball Sports Center', 'PC Street, Tabok', 'Mandaue City'),
  court('PUMPD Pickleball Cebu', 'Lopez Jaena St., Subangdaku', 'Mandaue City'),
  court('Side-out Pickleball Center', 'H. Abellana St, Pagsabungan', 'Mandaue City'),
  court('Velocity Pickleball Hub', 'Beside QC Pavilion, Gorordo Ave', 'Cebu City'),
  court('Zions Pickleball', 'Celadon Town, Pajac', 'Lapu-Lapu City'),
];
const names = (q: string, limit?: number) => matchCourts(COURTS, q, limit).map((c) => c.name);

describe('matchCourts', () => {
  it('finds a court by the start of a word in its name, ignoring case', () => {
    expect(names('dula')).toEqual(['DULA Pickleball Courts Cebu']);
    expect(names('ZIONS')).toEqual(['Zions Pickleball']);
  });

  it('needs every typed word to match', () => {
    expect(names('pickleball velocity')).toEqual(['Velocity Pickleball Hub']);
    expect(names('dula velocity')).toEqual([]);
  });

  it('matches the address and city too, ranked below name matches', () => {
    expect(names('gorordo')).toEqual(['Velocity Pickleball Hub']);
    expect(names('pickle lapu')).toEqual(['Zions Pickleball']);
  });

  it('ranks a name that starts with the query first', () => {
    expect(names('pick')[0]).toBe('Pickaball Sports Center');
  });

  it('ignores punctuation and spacing in names', () => {
    expect(names('sideout')).toEqual(['Side-out Pickleball Center']);
    expect(names('side out')).toEqual(['Side-out Pickleball Center']);
  });

  it('does not match the middle of a word', () => {
    expect(names('ckle')).toEqual([]);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(names('  ')).toEqual([]);
    expect(names('pickleball', 2)).toHaveLength(2);
  });
});
