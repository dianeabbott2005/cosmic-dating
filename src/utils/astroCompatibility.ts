
import { AstroChart, calculateCompatibility } from 'astroreha';

export interface BirthData {
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  latitude: number;
  longitude: number;
}

export interface CompatibilityResult {
  score: number;
  details: {
    sunSignCompatibility: number;
    moonSignCompatibility: number;
    risingSignCompatibility: number;
    venusCompatibility: number;
    marsCompatibility: number;
  };
}

export const calculateAstrologicalCompatibility = async (
  user1: BirthData,
  user2: BirthData
): Promise<CompatibilityResult> => {
  try {
    // Convert birth data to format expected by astroreha
    const chart1 = new AstroChart({
      year: parseInt(user1.date.split('-')[0]),
      month: parseInt(user1.date.split('-')[1]),
      day: parseInt(user1.date.split('-')[2]),
      hour: parseInt(user1.time.split(':')[0]),
      minute: parseInt(user1.time.split(':')[1]),
      latitude: user1.latitude,
      longitude: user1.longitude
    });

    const chart2 = new AstroChart({
      year: parseInt(user2.date.split('-')[0]),
      month: parseInt(user2.date.split('-')[1]),
      day: parseInt(user2.date.split('-')[2]),
      hour: parseInt(user2.time.split(':')[0]),
      minute: parseInt(user2.time.split(':')[1]),
      latitude: user2.latitude,
      longitude: user2.longitude
    });

    // Calculate compatibility using astroreha
    const compatibility = calculateCompatibility(chart1, chart2);
    
    // Extract detailed scores
    const details = {
      sunSignCompatibility: compatibility.sunCompatibility || 0.5,
      moonSignCompatibility: compatibility.moonCompatibility || 0.5,
      risingSignCompatibility: compatibility.risingCompatibility || 0.5,
      venusCompatibility: compatibility.venusCompatibility || 0.5,
      marsCompatibility: compatibility.marsCompatibility || 0.5,
    };

    // Calculate overall score (weighted average)
    const overallScore = (
      details.sunSignCompatibility * 0.3 +
      details.moonSignCompatibility * 0.25 +
      details.risingSignCompatibility * 0.15 +
      details.venusCompatibility * 0.2 +
      details.marsCompatibility * 0.1
    );

    return {
      score: Math.round(overallScore * 100) / 100, // Round to 2 decimal places
      details
    };
  } catch (error) {
    console.error('Error calculating astrological compatibility:', error);
    // Return a fallback compatibility score
    return {
      score: Math.random() * 0.4 + 0.3, // Random score between 0.3 and 0.7
      details: {
        sunSignCompatibility: Math.random(),
        moonSignCompatibility: Math.random(),
        risingSignCompatibility: Math.random(),
        venusCompatibility: Math.random(),
        marsCompatibility: Math.random(),
      }
    };
  }
};

export const getAstrologyInsight = (score: number): string => {
  if (score >= 0.8) return "Cosmic soulmates! The stars are perfectly aligned for this connection.";
  if (score >= 0.7) return "Strong cosmic connection with great potential for harmony.";
  if (score >= 0.6) return "Good astrological compatibility with interesting dynamics.";
  if (score >= 0.5) return "Moderate compatibility that could grow with understanding.";
  return "Challenging aspects that require patience and compromise.";
};
