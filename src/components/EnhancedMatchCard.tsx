import { Heart, MapPin, MessageCircle, MoreVertical, ShieldOff } from 'lucide-react';
import { getSunSign } from '@/utils/astro/zodiacCalculations';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BlockUserDialog } from "@/components/BlockUserDialog";
import { useState } from 'react';
import { useMatches } from '@/hooks/useMatches';

interface EnhancedMatchCardProps {
  match: {
    id?: string;
    user_id?: string;
    first_name: string;
    last_name?: string;
    age: number;
    place_of_birth?: string;
    current_city?: string | null;
    date_of_birth?: string;
    time_of_birth?: string;
    compatibility_score?: number;
    compatibility?: number;
    gender?: string;
  };
  onStartChat: () => void;
  onViewProfile?: () => void;
}

const EnhancedMatchCard = ({ match, onStartChat, onViewProfile }: EnhancedMatchCardProps) => {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const { refreshMatches } = useMatches();
  const sunSign = match.date_of_birth ? getSunSign(match.date_of_birth) : null;

  const formatSignName = (sign: string | null) => {
    if (!sign) return '';
    return sign.charAt(0).toUpperCase() + sign.slice(1);
  };

  const displayName = `${match.first_name}${match.last_name ? ` ${match.last_name.charAt(0)}.` : ''}`;

  return (
    <>
      <div className="card-cosmic transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
        <div className="relative mb-4">
          <div className="w-full h-64 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-6xl font-bold">
              {match.first_name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">
              {displayName}, {match.age}
            </h3>
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-400 hover:fill-current transition-colors cursor-pointer" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-gray-400 hover:text-white p-1 rounded-full">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setIsBlockDialogOpen(true)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                    <ShieldOff className="mr-2 h-4 w-4" />
                    <span>Block {displayName}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {(match.current_city || match.place_of_birth) && (
            <div className="flex items-center gap-2 text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{match.current_city || match.place_of_birth}</span>
            </div>
          )}

          {sunSign && (
            <div className="flex items-center justify-center py-2">
              <div className="text-center">
                <div className="text-purple-300 font-medium">☀️ {formatSignName(sunSign)}</div>
                <div className="text-gray-500 text-xs">Sun Sign</div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-700">
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
      {match.user_id && (
        <BlockUserDialog
          open={isBlockDialogOpen}
          onOpenChange={setIsBlockDialogOpen}
          userIdToBlock={match.user_id}
          userName={displayName}
          onSuccess={refreshMatches}
        />
      )}
    </>
  );
};

export default EnhancedMatchCard;