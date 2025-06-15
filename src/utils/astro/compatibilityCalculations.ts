
import { ZODIAC_SIGNS } from './constants';

export const calculateElementCompatibility = (element1: string, element2: string): number => {
  const compatibleElements = {
    fire: { fire: 0.9, air: 0.8, earth: 0.4, water: 0.3 },
    earth: { earth: 0.9, water: 0.8, fire: 0.4, air: 0.3 },
    air: { air: 0.9, fire: 0.8, water: 0.4, earth: 0.3 },
    water: { water: 0.9, earth: 0.8, air: 0.4, fire: 0.3 }
  };
  
  return compatibleElements[element1 as keyof typeof compatibleElements]?.[element2 as keyof typeof compatibleElements.fire] || 0.5;
};

export const calculateSunSignCompatibility = (sign1: string, sign2: string): number => {
  if (sign1 === sign2) return 0.85;
  
  const opposites = {
    aries: 'libra', taurus: 'scorpio', gemini: 'sagittarius',
    cancer: 'capricorn', leo: 'aquarius', virgo: 'pisces'
  };
  
  const reverseOpposites = Object.fromEntries(
    Object.entries(opposites).map(([k, v]) => [v, k])
  );
  
  if (opposites[sign1 as keyof typeof opposites] === sign2 || 
      reverseOpposites[sign1 as keyof typeof reverseOpposites] === sign2) {
    return 0.75;
  }
  
  const sign1Index = ZODIAC_SIGNS.indexOf(sign1);
  const sign2Index = ZODIAC_SIGNS.indexOf(sign2);
  const distance = Math.min(
    Math.abs(sign1Index - sign2Index),
    12 - Math.abs(sign1Index - sign2Index)
  );
  
  if (distance === 4) return 0.9;
  if (distance === 2) return 0.8;
  if (distance === 3) return 0.4;
  if (distance === 1 || distance === 5) return 0.6;
  
  return 0.5;
};

export const calculateTimeCompatibility = (time1: string, time2: string): number => {
  const getHour = (time: string) => parseInt(time.split(':')[0]);
  
  const hour1 = getHour(time1);
  const hour2 = getHour(time2);
  
  const timeDiff = Math.abs(hour1 - hour2);
  const minDiff = Math.min(timeDiff, 24 - timeDiff);
  
  return Math.max(0.3, 1 - (minDiff / 12));
};
