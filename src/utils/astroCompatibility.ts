import { BirthData } from './astro/types';
import { getSunSign, getMoonSign, getElement } from './astro/zodiacCalculations';
import { 
  calculateElementCompatibility, 
  calculateSunSignCompatibility, 
  calculateTimeCompatibility 
} from './astro/compatibilityCalculations';

const calculateFallbackCompatibility = (person1: BirthData, person2: BirthData): number => {
  try {
    const date1 = new Date(person1.dateOfBirth);
    const date2 = new Date(person2.dateOfBirth);

    const ageDiff = Math.abs(date1.getFullYear() - date2.getFullYear());
    const ageCompatibility = Math.max(0.3, 1 - (ageDiff * 0.02));
    const randomFactor = 0.4 + (Math.random() * 0.5);

    return Math.min(ageCompatibility * randomFactor, 0.95);
  } catch (error) {
    console.error('calculateFallbackCompatibility: Error in fallback compatibility calculation:', error);
    return 0.5;
  }
};

export const calculateCompatibility = async (person1: BirthData, person2: BirthData): Promise<number> => {
  try {
    if (!person1.dateOfBirth || !person1.timeOfBirth || 
        !person2.dateOfBirth || !person2.timeOfBirth) {
      console.warn('calculateCompatibility: Missing birth data for compatibility calculation. Falling back.');
      const fallbackScore = calculateFallbackCompatibility(person1, person2);
      console.log(`calculateCompatibility: Fallback score: ${Math.round(fallbackScore * 100)}%`);
      return fallbackScore;
    }

    const sunSign1 = getSunSign(person1.dateOfBirth);
    const sunSign2 = getSunSign(person2.dateOfBirth);
    const moonSign1 = getMoonSign(person1.dateOfBirth, person1.timeOfBirth);
    const moonSign2 = getMoonSign(person2.dateOfBirth, person2.timeOfBirth);
    
    const sunElement1 = getElement(sunSign1);
    const sunElement2 = getElement(sunSign2);
    const moonElement1 = getElement(moonSign1);
    const moonElement2 = getElement(moonSign2);
    
    const sunCompatibility = calculateSunSignCompatibility(sunSign1, sunSign2);
    const moonCompatibility = calculateSunSignCompatibility(moonSign1, moonSign2);
    const sunElementCompatibility = calculateElementCompatibility(sunElement1, sunElement2);
    const moonElementCompatibility = calculateElementCompatibility(moonElement1, moonElement2);
    const timeCompatibility = calculateTimeCompatibility(person1.timeOfBirth, person2.timeOfBirth);
    
    let locationCompatibility = 0.5;
    if (person1.latitude && person1.longitude && person2.latitude && person2.longitude) {
      const distance = Math.sqrt(
        Math.pow(person1.latitude - person2.latitude, 2) + 
        Math.pow(person1.longitude - person2.longitude, 2)
      );
      locationCompatibility = Math.max(0.3, 1 - (distance / 180));
    }
    
    const overallCompatibility = (
      sunCompatibility * 0.25 +
      moonCompatibility * 0.20 +
      sunElementCompatibility * 0.15 +
      moonElementCompatibility * 0.15 +
      timeCompatibility * 0.15 +
      locationCompatibility * 0.10
    );
    
    const randomFactor = 0.9 + (Math.random() * 0.2);
    const finalScore = Math.min(0.99, Math.max(0.1, overallCompatibility * randomFactor));
    
    console.log(`calculateCompatibility: Final score for ${sunSign1}-${sunSign2} (Moon: ${moonSign1}-${moonSign2}): ${Math.round(finalScore * 100)}%`);
    console.log(`  Breakdown: Sun: ${sunCompatibility.toFixed(2)}, Moon: ${moonCompatibility.toFixed(2)}, Sun Element: ${sunElementCompatibility.toFixed(2)}, Moon Element: ${moonElementCompatibility.toFixed(2)}, Time: ${timeCompatibility.toFixed(2)}, Location: ${locationCompatibility.toFixed(2)}`);
    
    return finalScore;

  } catch (error) {
    console.error('calculateCompatibility: Error calculating astrological compatibility:', error);
    const fallbackScore = calculateFallbackCompatibility(person1, person2);
    console.log(`calculateCompatibility: Falling back to score: ${Math.round(fallbackScore * 100)}% due to error.`);
    return fallbackScore;
  }
};

// Re-export the insight function for backward compatibility
export { getAstrologicalInsight } from './astro/insights';