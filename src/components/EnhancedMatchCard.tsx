
import { Heart, MapPin, Star, MessageCircle } from 'lucide-react';

interface EnhancedMatchCardProps {
  match: {
    id?: string;
    user_id?: string;
    first_name: string;
    last_name?: string;
    age: number;
    place_of_birth?: string;
    compatibility_score?: number;
    compatibility?: number;
    gender?: string;
  };
  onStartChat: () => void;
  onViewProfile?: () => void;
}

const EnhancedMatchCard = ({ match, onStartChat, onViewProfile }: EnhancedMatchCardProps) => {
  const compatibilityScore = match.compatibility_score ? Math.round(match.compatibility_score * 100) : match.compatibility || 0;

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getCompatibilityBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/30';
    if (score >= 70) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-orange-500/20 border-orange-500/30';
  };

  return (
    <div className="card-cosmic transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
      {/* Profile Avatar */}
      <div className="relative mb-4">
        <div className="w-full h-64 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
          <span className="text-white text-6xl font-bold">
            {match.first_name?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full border ${getCompatibilityBg(compatibilityScore)}`}>
          <span className={`text-sm font-semibold ${getCompatibilityColor(compatibilityScore)}`}>
            {compatibilityScore}% ✨
          </span>
        </div>
      </div>

      {/* Profile Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">
            {match.first_name}, {match.age}
          </h3>
          <Heart className="w-6 h-6 text-pink-400 hover:fill-current transition-colors cursor-pointer" />
        </div>

        {match.place_of_birth && (
          <div className="flex items-center gap-2 text-gray-400">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{match.place_of_birth}</span>
          </div>
        )}

        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Cosmic Compatibility</span>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.floor(compatibilityScore / 20)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onStartChat}
            className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-medium hover:from-pink-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Start Chat
          </button>
          {onViewProfile && (
            <button 
              onClick={onViewProfile}
              className="px-4 py-3 border border-purple-500 text-purple-400 rounded-xl hover:bg-purple-500/10 transition-all"
            >
              Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedMatchCard;
