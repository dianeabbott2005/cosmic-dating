
import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';

interface ProfileCompleteProps {
  onNext: (data: any) => void;
  userData: any;
}

const ProfileComplete = ({ onNext, userData }: ProfileCompleteProps) => {
  const [isCalculating, setIsCalculating] = useState(true);
  const [matchesFound, setMatchesFound] = useState(0);

  useEffect(() => {
    // Simulate compatibility calculation process
    const calculateMatches = () => {
      const intervals = [500, 1000, 1500, 2000, 2500];
      const targetMatches = Math.floor(Math.random() * 20) + 5; // 5-25 matches
      
      intervals.forEach((delay, index) => {
        setTimeout(() => {
          const progress = Math.floor((targetMatches * (index + 1)) / intervals.length);
          setMatchesFound(progress);
          
          if (index === intervals.length - 1) {
            setTimeout(() => {
              setIsCalculating(false);
            }, 1000);
          }
        }, delay);
      });
    };

    calculateMatches();
  }, []);

  const handleContinue = () => {
    onNext({ matchesFound });
  };

  if (isCalculating) {
    return (
      <div className="text-center py-8">
        <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
          <Sparkles className="w-12 h-12 text-white animate-spin" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-4">
          Calculating Cosmic Compatibility...
        </h3>
        
        <p className="text-gray-400 mb-6">
          Analyzing planetary alignments and birth chart patterns
        </p>

        <div className="bg-slate-800/50 rounded-full h-2 mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000 animate-shimmer"
            style={{ width: `${Math.min((matchesFound / 20) * 100, 100)}%` }}
          ></div>
        </div>

        <div className="text-center">
          <p className="text-lg text-purple-300 font-semibold">
            {matchesFound} potential matches found...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a few moments as we analyze thousands of profiles
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8 text-sm">
          <div className="text-center">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              ✨
            </div>
            <p className="text-gray-400">Sun Signs</p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              🌙
            </div>
            <p className="text-gray-400">Moon Phases</p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              🪐
            </div>
            <p className="text-gray-400">Planetary Alignment</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-12 h-12 text-green-400" />
      </div>
      
      <h3 className="text-3xl font-bold text-white mb-4">
        Profile Complete! 🎉
      </h3>
      
      <p className="text-gray-400 mb-6">
        Your cosmic profile has been created successfully
      </p>

      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-xl p-6 mb-8">
        <h4 className="text-green-300 font-semibold text-xl mb-2">
          🌟 {matchesFound} Cosmic Matches Found!
        </h4>
        <p className="text-gray-300">
          We've found {matchesFound} astrologically compatible profiles that match your preferences. 
          These connections have a compatibility score above 60% based on your birth charts.
        </p>
      </div>

      <div className="space-y-3 mb-8 text-left">
        <div className="flex items-center gap-3 text-gray-300">
          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
          <span>Birth chart compatibility calculated</span>
        </div>
        <div className="flex items-center gap-3 text-gray-300">
          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          <span>Age and gender preferences applied</span>
        </div>
        <div className="flex items-center gap-3 text-gray-300">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span>Cosmic compatibility scores generated</span>
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="btn-cosmic w-full text-xl py-4"
      >
        Explore Your Matches ✨
      </button>
    </div>
  );
};

export default ProfileComplete;
