/**
 * SM-2 Spaced Repetition Algorithm implementation.
 * Calculates the next interval, ease factor, and repetition count
 * based on user review quality (0 to 5 scale).
 * 
 * Quality ratings:
 * 5 - Perfect response, zero hesitation
 * 4 - Correct response after some hesitation
 * 3 - Correct response recalled with serious difficulty
 * 2 - Incorrect response; where the correct one seemed easy to recall
 * 1 - Incorrect response; the correct one remembered
 * 0 - Complete blackout
 */
export const calculateSM2 = (quality, prevInterval = 1, prevEaseFactor = 2.5, repetitions = 0) => {
  let interval = 1;
  let easeFactor = prevEaseFactor;
  let nextRepetitions = repetitions;

  // Enforce quality boundaries
  if (quality < 0) quality = 0;
  if (quality > 5) quality = 5;

  if (quality >= 3) {
    // Correct response
    if (nextRepetitions === 0) {
      interval = 1;
    } else if (nextRepetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(prevInterval * easeFactor);
    }
    nextRepetitions++;
  } else {
    // Incorrect response - reset repetitions, review tomorrow
    nextRepetitions = 0;
    interval = 1;
  }

  // Update ease factor (EF) using standard SM-2 formula
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Ease factor shouldn't drop below 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  return {
    interval,
    easeFactor: parseFloat(easeFactor.toFixed(3)),
    repetitions: nextRepetitions
  };
};
