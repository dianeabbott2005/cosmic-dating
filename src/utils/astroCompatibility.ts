import { BirthData } from './astro/types';
import { getSunSign, getMoonSign, getElement } from './astro/zodiacCalculations'; // Keep for display/insight purposes
import { getCompatibility, BirthChartData } from 'astroreha'; // Import astroreha

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
    // Ensure all necessary birth data is present for astroreha
    if (!person1.dateOfBirth || !person1.timeOfBirth || person1.latitude === null || person1.longitude === null ||
        !person2.dateOfBirth || !person2.timeOfBirth || person2.latitude === null || person2.longitude === null) {
      console.warn('calculateCompatibility: Missing complete birth data for astroreha. Falling back to basic compatibility.');
      const fallbackScore = calculateFallbackCompatibility(person1, person2);
      console.log(`calculateCompatibility: Fallback score: ${Math.round(fallbackScore * 100)}%`);
      return fallbackScore;
    }

    // Prepare data for astroreha
    const chart1: BirthChartData = {
      date: new Date(person1.dateOfBirth),
      time: person1.timeOfBirth,
      lat: person1.latitude,
      lon: person1.longitude,
    };

    const chart2: BirthChartData = {
      date: new Date(person2.dateOfBirth),
      time: person2.timeOfBirth,
      lat: person2.latitude,
      lon: person2.longitude,
    };

    // Calculate compatibility using astroreha
    const compatibilityScore = getCompatibility(chart1, chart2);
    
    // astroreha returns a score between 0 and 1. We can scale it if needed,
    // but for a 0.6 threshold, it's fine as is.
    const finalScore = Math.min(0.99, Math.max(0.1, compatibilityScore)); // Ensure score is within a reasonable range

    console.log(`calculateCompatibility: Astroreha compatibility score: ${Math.round(finalScore * 100)}%`);
    
    return finalScore;

  } catch (error) {
    console.error('calculateCompatibility: Error calculating astrological compatibility with astroreha:', error);
    const fallbackScore = calculateFallbackCompatibility(person1, person2);
    console.log(`calculateCompatibility: Falling back to score: ${Math.round(fallbackScore * 100)}% due to error.`);
    return fallbackScore;
  }
};

// Re-export the insight function for backward compatibility
export { getAstrologicalInsight } from './astro/insights';