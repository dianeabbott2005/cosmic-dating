
import { Heart, MapPin } from 'lucide-react';

interface MatchCardProps {
  match: {
    id: number;
    firstName: string;
    age: number;
    location: string;
    compatibility: number;
    sunSign: string;
    moonSign: string;
    avatar: string;
  };
  onClick: () => void;
}

const MatchCard = ({ match, onClick }: MatchCardProps) => {
  return (
    <div 
      onClick={onClick}
      className="card-cosmic cursor-pointer transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20"
    >
      {/* Profile Image */}
      <div className="relative mb-4">
        <img
          src={match.avatar}
          alt={match.firstName}
          className="w-full h-64 object-cover rounded-xl"
        />
      </div>

      {/* Profile Info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">
            {match.firstName}, {match.age}
          </h3>
          <Heart className="w-6 h-6 text-pink-400 hover:fill-current transition-colors" />
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">{match.location}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-purple-300 font-medium">☀️ {match.sunSign}</div>
              <div className="text-gray-500 text-xs">Sun</div>
            </div>
            <div className="text-center">
              <div className="text-blue-300 font-medium">🌙 {match.moonSign}</div>
              <div className="text-gray-500 text-xs">Moon</div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-medium hover:from-pink-600 hover:to-purple-600 transition-all">
            Start Conversation
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
