const MAX_SCORE = 64;

// Thresholds are a starting point for KEMSAP to tune after piloting real interviews.
function calculateRating(totalScore, redFlags) {
  if (redFlags) return 'RISKY';
  if (totalScore >= 50) return 'HIRE';
  if (totalScore >= 38) return 'CONSIDER';
  if (totalScore >= 25) return 'RISKY';
  return 'PASS';
}

module.exports = { calculateRating, MAX_SCORE };
