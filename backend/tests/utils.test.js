const generateSessionCode = require('../src/utils/sessionCode');
const { calculateRating } = require('../src/utils/rating');

describe('generateSessionCode', () => {
  it('produces 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateSessionCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe('calculateRating', () => {
  it.each([
    [64, false, 'HIRE'],
    [50, false, 'HIRE'],
    [49, false, 'CONSIDER'],
    [38, false, 'CONSIDER'],
    [37, false, 'RISKY'],
    [25, false, 'RISKY'],
    [24, false, 'PASS'],
    [64, true, 'RISKY'],
  ])('score %i with redFlags=%s -> %s', (score, redFlags, expected) => {
    expect(calculateRating(score, redFlags)).toBe(expected);
  });
});
