
import { BirthData } from './types';
import { getSunSign, getMoonSign } from './zodiacCalculations';

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
