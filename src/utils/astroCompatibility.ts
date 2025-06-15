interface BirthData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
}

// Zodiac signs and their properties
const ZODIAC_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

const ELEMENTS = {
  fire: ['aries', 'leo', 'sagittarius'],
  earth: ['taurus', 'virgo', 'capricorn'], 
  air: ['gemini', 'libra', 'aquarius'],
  water: ['cancer', 'scorpio', 'pisces']
};

const MODALITIES = {
  cardinal: ['aries', 'cancer', 'libra', 'capricorn'],
  fixed: ['taurus', 'leo', 'scorpio', 'aquarius'],
  mutable: ['gemini', 'virgo', 'sagittarius', 'pisces']
};

// Calculate sun sign based on birth date
const getSunSign = (dateOfBirth: string): string => {
  const date = new Date(dateOfBirth);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Simplified sun sign calculation
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'pisces';
  
  return 'aries'; // fallback
};

// Calculate moon sign based on birth date and time (simplified)
const getMoonSign = (dateOfBirth: string, timeOfBirth: string): string => {
  const date = new Date(dateOfBirth);
  const time = new Date(`${dateOfBirth}T${timeOfBirth}`);
  
  // Simplified moon sign calculation using day of year and time
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const hours = time.getHours() + (time.getMinutes() / 60);
  
  // Moon moves through all signs in ~28 days
  const moonCycle = ((dayOfYear + (hours / 24)) * 12 / 28) % 12;
  return ZODIAC_SIGNS[Math.floor(moonCycle)];
};

// Get element of a sign
const getElement = (sign: string): string => {
  for (const [element, signs] of Object.entries(ELEMENTS)) {
    if (signs.includes(sign)) return element;
  }
  return 'fire'; // fallback
};

// Get modality of a sign
const getModality = (sign: string): string => {
  for (const [modality, signs] of Object.entries(MODALITIES)) {
    if (signs.includes(sign)) return modality;
  }
  return 'cardinal'; // fallback
};

// Calculate element compatibility
const calculateElementCompatibility = (element1: string, element2: string): number => {
  const compatibleElements = {
    fire: { fire: 0.9, air: 0.8, earth: 0.4, water: 0.3 },
    earth: { earth: 0.9, water: 0.8, fire: 0.4, air: 0.3 },
    air: { air: 0.9, fire: 0.8, water: 0.4, earth: 0.3 },
    water: { water: 0.9, earth: 0.8, air: 0.4, fire: 0.3 }
  };
  
  return compatibleElements[element1 as keyof typeof compatibleElements]?.[element2 as keyof typeof compatibleElements.fire] || 0.5;
};

// Calculate sun sign compatibility
const calculateSunSignCompatibility = (sign1: string, sign2: string): number => {
  // Same sign compatibility
  if (sign1 === sign2) return 0.85;
  
  // Complementary signs (opposite signs)
  const opposites = {
    aries: 'libra', taurus: 'scorpio', gemini: 'sagittarius',
    cancer: 'capricorn', leo: 'aquarius', virgo: 'pisces'
  };
  
  const reverseOpposites = Object.fromEntries(
    Object.entries(opposites).map(([k, v]) => [v, k])
  );
  
  if (opposites[sign1 as keyof typeof opposites] === sign2 || 
      reverseOpposites[sign1 as keyof typeof reverseOpposites] === sign2) {
    return 0.75; // Opposites attract but can be challenging
  }
  
  // Trine aspects (4 signs apart)
  const sign1Index = ZODIAC_SIGNS.indexOf(sign1);
  const sign2Index = ZODIAC_SIGNS.indexOf(sign2);
  const distance = Math.min(
    Math.abs(sign1Index - sign2Index),
    12 - Math.abs(sign1Index - sign2Index)
  );
  
  if (distance === 4) return 0.9; // Trine - very harmonious
  if (distance === 2) return 0.8; // Sextile - harmonious
  if (distance === 3) return 0.4; // Square - challenging
  if (distance === 1 || distance === 5) return 0.6; // Semi-sextile/quincunx
  
  return 0.5; // Default compatibility
};

// Calculate birth time compatibility
const calculateTimeCompatibility = (time1: string, time2: string): number => {
  const getHour = (time: string) => parseInt(time.split(':')[0]);
  
  const hour1 = getHour(time1);
  const hour2 = getHour(time2);
  
  const timeDiff = Math.abs(hour1 - hour2);
  const minDiff = Math.min(timeDiff, 24 - timeDiff);
  
  // Similar birth times suggest similar life rhythms
  return Math.max(0.3, 1 - (minDiff / 12));
};

export const calculateCompatibility = async (person1: BirthData, person2: BirthData): Promise<number> => {
  try {
    // Validate that we have required data
    if (!person1.dateOfBirth || !person1.timeOfBirth || 
        !person2.dateOfBirth || !person2.timeOfBirth) {
      console.warn('Missing birth data for compatibility calculation');
      return calculateFallbackCompatibility(person1, person2);
    }

    // Calculate sun signs
    const sunSign1 = getSunSign(person1.dateOfBirth);
    const sunSign2 = getSunSign(person2.dateOfBirth);
    
    // Calculate moon signs
    const moonSign1 = getMoonSign(person1.dateOfBirth, person1.timeOfBirth);
    const moonSign2 = getMoonSign(person2.dateOfBirth, person2.timeOfBirth);
    
    // Get elements
    const sunElement1 = getElement(sunSign1);
    const sunElement2 = getElement(sunSign2);
    const moonElement1 = getElement(moonSign1);
    const moonElement2 = getElement(moonSign2);
    
    // Calculate various compatibility scores
    const sunCompatibility = calculateSunSignCompatibility(sunSign1, sunSign2);
    const moonCompatibility = calculateSunSignCompatibility(moonSign1, moonSign2);
    const sunElementCompatibility = calculateElementCompatibility(sunElement1, sunElement2);
    const moonElementCompatibility = calculateElementCompatibility(moonElement1, moonElement2);
    const timeCompatibility = calculateTimeCompatibility(person1.timeOfBirth, person2.timeOfBirth);
    
    // Location compatibility (if available)
    let locationCompatibility = 0.5;
    if (person1.latitude && person1.longitude && person2.latitude && person2.longitude) {
      const distance = Math.sqrt(
        Math.pow(person1.latitude - person2.latitude, 2) + 
        Math.pow(person1.longitude - person2.longitude, 2)
      );
      locationCompatibility = Math.max(0.3, 1 - (distance / 180)); // Normalize to 0-1
    }
    
    // Weighted average of all compatibility factors
    const overallCompatibility = (
      sunCompatibility * 0.25 +           // Sun sign compatibility - 25%
      moonCompatibility * 0.20 +          // Moon sign compatibility - 20%
      sunElementCompatibility * 0.15 +    // Sun element compatibility - 15%
      moonElementCompatibility * 0.15 +   // Moon element compatibility - 15%
      timeCompatibility * 0.15 +          // Birth time compatibility - 15%
      locationCompatibility * 0.10        // Location compatibility - 10%
    );
    
    // Add some randomness for variety while keeping it realistic
    const randomFactor = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
    const finalScore = Math.min(0.99, Math.max(0.1, overallCompatibility * randomFactor));
    
    console.log(`Compatibility calculated: ${sunSign1}-${sunSign2} = ${Math.round(finalScore * 100)}%`);
    
    return finalScore;

  } catch (error) {
    console.error('Error calculating astrological compatibility:', error);
    return calculateFallbackCompatibility(person1, person2);
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
    const randomFactor = 0.4 + (Math.random() * 0.5); // 0.4 to 0.9

    return Math.min(ageCompatibility * randomFactor, 0.95);
  } catch (error) {
    console.error('Error in fallback compatibility calculation:', error);
    return 0.5; // Default 50% compatibility
  }
};

export const getAstrologicalInsight = async (person1: BirthData, person2: BirthData): Promise<string> => {
  try {
    const sunSign1 = getSunSign(person1.dateOfBirth);
    const sunSign2 = getSunSign(person2.dateOfBirth);
    const moonSign1 = getMoonSign(person1.dateOfBirth, person1.timeOfBirth);
    const moonSign2 = getMoonSign(person2.dateOfBirth, person2.timeOfBirth);

    const insights = [
      `Your ${sunSign1} sun creates a beautiful dynamic with their ${sunSign2} energy.`,
      `The ${moonSign1}-${moonSign2} moon combination suggests deep emotional understanding.`,
      `Your birth times indicate ${Math.abs(parseInt(person1.timeOfBirth.split(':')[0]) - parseInt(person2.timeOfBirth.split(':')[0])) < 6 ? 'similar life rhythms' : 'complementary daily cycles'}.`,
      `The cosmic alignment between your charts shows potential for lasting connection.`
    ];

    return insights[Math.floor(Math.random() * insights.length)];

  } catch (error) {
    console.error('Error generating astrological insight:', error);
    return "Your cosmic energies align in mysterious and wonderful ways. The stars suggest a meaningful connection awaits.";
  }
};
