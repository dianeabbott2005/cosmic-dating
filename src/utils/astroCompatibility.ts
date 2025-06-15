
import { Astroreha } from 'astroreha';

interface BirthData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
}

export const calculateCompatibility = async (person1: BirthData, person2: BirthData): Promise<number> => {
  try {
    // Validate that we have required data
    if (!person1.dateOfBirth || !person1.timeOfBirth || !person1.latitude || !person1.longitude ||
        !person2.dateOfBirth || !person2.timeOfBirth || !person2.latitude || !person2.longitude) {
      console.warn('Missing birth data for compatibility calculation');
      return 0;
    }

    // Parse birth dates and times
    const date1 = new Date(`${person1.dateOfBirth}T${person1.timeOfBirth}`);
    const date2 = new Date(`${person2.dateOfBirth}T${person2.timeOfBirth}`);

    // Create birth chart data for astroreha
    const birthData1 = {
      year: date1.getFullYear(),
      month: date1.getMonth() + 1,
      day: date1.getDate(),
      hour: date1.getHours(),
      minute: date1.getMinutes(),
      latitude: person1.latitude,
      longitude: person1.longitude
    };

    const birthData2 = {
      year: date2.getFullYear(),
      month: date2.getMonth() + 1,
      day: date2.getDate(),
      hour: date2.getHours(),
      minute: date2.getMinutes(),
      latitude: person2.latitude,
      longitude: person2.longitude
    };

    // Initialize Astroreha
    const astro = new Astroreha();

    // Calculate birth charts
    const chart1 = astro.calculateChart(birthData1);
    const chart2 = astro.calculateChart(birthData2);

    // Calculate synastry (compatibility) between the two charts
    const synastry = astro.calculateSynastry(chart1, chart2);

    // Calculate overall compatibility score
    // This is a simplified algorithm - you can make it more sophisticated
    let compatibilityScore = 0;
    let totalAspects = 0;

    // Analyze major planetary aspects between the charts
    const majorPlanets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
    
    for (const planet1 of majorPlanets) {
      for (const planet2 of majorPlanets) {
        if (synastry.aspects && synastry.aspects[planet1] && synastry.aspects[planet1][planet2]) {
          const aspects = synastry.aspects[planet1][planet2];
          
          for (const aspect of aspects) {
            totalAspects++;
            
            // Score aspects based on type and orb
            switch (aspect.type) {
              case 'conjunction':
                compatibilityScore += aspect.orb < 3 ? 10 : 8;
                break;
              case 'trine':
                compatibilityScore += aspect.orb < 3 ? 9 : 7;
                break;
              case 'sextile':
                compatibilityScore += aspect.orb < 3 ? 8 : 6;
                break;
              case 'square':
                compatibilityScore += aspect.orb < 3 ? 5 : 3; // Challenging but can be workable
                break;
              case 'opposition':
                compatibilityScore += aspect.orb < 3 ? 6 : 4; // Can be complementary
                break;
              default:
                compatibilityScore += 3;
            }
          }
        }
      }
    }

    // Calculate element compatibility
    const elementScore = calculateElementCompatibility(chart1, chart2);
    compatibilityScore += elementScore;

    // Calculate moon phase compatibility
    const moonPhaseScore = calculateMoonPhaseCompatibility(chart1, chart2);
    compatibilityScore += moonPhaseScore;

    // Normalize the score to a 0-1 range
    const maxPossibleScore = (totalAspects * 10) + 20 + 10; // aspects + elements + moon phases
    const normalizedScore = Math.min(compatibilityScore / Math.max(maxPossibleScore, 100), 1);

    // Ensure minimum threshold for matches
    return Math.max(normalizedScore, 0.1); // Minimum 10% compatibility

  } catch (error) {
    console.error('Error calculating astrological compatibility:', error);
    // Fallback to a simple age-based compatibility if astrological calculation fails
    return calculateFallbackCompatibility(person1, person2);
  }
};

const calculateElementCompatibility = (chart1: any, chart2: any): number => {
  try {
    const elements = {
      fire: ['aries', 'leo', 'sagittarius'],
      earth: ['taurus', 'virgo', 'capricorn'],
      air: ['gemini', 'libra', 'aquarius'],
      water: ['cancer', 'scorpio', 'pisces']
    };

    // Get sun signs
    const sunSign1 = chart1.planets?.sun?.sign?.toLowerCase();
    const sunSign2 = chart2.planets?.sun?.sign?.toLowerCase();

    if (!sunSign1 || !sunSign2) return 5; // Default score if signs not available

    // Find elements
    let element1 = null;
    let element2 = null;

    for (const [element, signs] of Object.entries(elements)) {
      if (signs.includes(sunSign1)) element1 = element;
      if (signs.includes(sunSign2)) element2 = element;
    }

    if (!element1 || !element2) return 5;

    // Compatible element combinations
    const compatibleElements = {
      fire: ['air', 'fire'],
      earth: ['water', 'earth'],
      air: ['fire', 'air'],
      water: ['earth', 'water']
    };

    return compatibleElements[element1 as keyof typeof compatibleElements]?.includes(element2) ? 15 : 5;
  } catch (error) {
    console.error('Error calculating element compatibility:', error);
    return 5;
  }
};

const calculateMoonPhaseCompatibility = (chart1: any, chart2: any): number => {
  try {
    // Get moon positions
    const moon1 = chart1.planets?.moon?.longitude;
    const moon2 = chart2.planets?.moon?.longitude;

    if (typeof moon1 !== 'number' || typeof moon2 !== 'number') return 5;

    // Calculate moon phase difference
    let phaseDiff = Math.abs(moon1 - moon2);
    if (phaseDiff > 180) phaseDiff = 360 - phaseDiff;

    // Score based on moon phase harmony
    if (phaseDiff < 30) return 10; // Very harmonious
    if (phaseDiff < 60) return 8;  // Good harmony
    if (phaseDiff < 90) return 6;  // Moderate harmony
    if (phaseDiff < 120) return 4; // Some challenges
    return 2; // Needs work

  } catch (error) {
    console.error('Error calculating moon phase compatibility:', error);
    return 5;
  }
};

const calculateFallbackCompatibility = (person1: BirthData, person2: BirthData): number => {
  try {
    // Simple fallback based on birth dates
    const date1 = new Date(person1.dateOfBirth);
    const date2 = new Date(person2.dateOfBirth);

    // Calculate age difference
    const ageDiff = Math.abs(date1.getFullYear() - date2.getFullYear());

    // Base compatibility on age similarity and random factor for variety
    const ageCompatibility = Math.max(0.3, 1 - (ageDiff * 0.02));
    const randomFactor = 0.3 + (Math.random() * 0.4); // 0.3 to 0.7

    return Math.min(ageCompatibility * randomFactor, 0.95);
  } catch (error) {
    console.error('Error in fallback compatibility calculation:', error);
    return 0.5; // Default 50% compatibility
  }
};

export const getAstrologicalInsight = async (person1: BirthData, person2: BirthData): Promise<string> => {
  try {
    const astro = new Astroreha();
    
    const date1 = new Date(`${person1.dateOfBirth}T${person1.timeOfBirth}`);
    const date2 = new Date(`${person2.dateOfBirth}T${person2.timeOfBirth}`);

    const chart1 = astro.calculateChart({
      year: date1.getFullYear(),
      month: date1.getMonth() + 1,
      day: date1.getDate(),
      hour: date1.getHours(),
      minute: date1.getMinutes(),
      latitude: person1.latitude || 0,
      longitude: person1.longitude || 0
    });

    const chart2 = astro.calculateChart({
      year: date2.getFullYear(),
      month: date2.getMonth() + 1,
      day: date2.getDate(),
      hour: date2.getHours(),
      minute: date2.getMinutes(),
      latitude: person2.latitude || 0,
      longitude: person2.longitude || 0
    });

    const sunSign1 = chart1.planets?.sun?.sign || 'Unknown';
    const sunSign2 = chart2.planets?.sun?.sign || 'Unknown';
    const moonSign1 = chart1.planets?.moon?.sign || 'Unknown';
    const moonSign2 = chart2.planets?.moon?.sign || 'Unknown';

    return `Your ${sunSign1} sun connects beautifully with their ${sunSign2} energy. ` +
           `The ${moonSign1}-${moonSign2} moon combination creates emotional harmony and understanding.`;

  } catch (error) {
    console.error('Error generating astrological insight:', error);
    return "Your cosmic energies align in mysterious and wonderful ways. The stars suggest a meaningful connection awaits.";
  }
};
