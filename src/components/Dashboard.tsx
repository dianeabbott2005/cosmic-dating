
import { useState, useEffect } from 'react';
import { Heart, User, MessageSquare, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EnhancedMatchCard from '@/components/EnhancedMatchCard';
import EnhancedChatView from '@/components/EnhancedChatView';
import { useMatches } from '@/hooks/useMatches';

interface DashboardProps {
  user: any;
}

const Dashboard = ({ user }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'chats'>('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const { matches, loading, refreshMatches } = useMatches();
  const navigate = useNavigate();

  const handleMatchClick = (match: any) => {
    setSelectedMatch(match);
    setActiveTab('chats');
  };

  if (selectedMatch && activeTab === 'chats') {
    return (
      <EnhancedChatView 
        match={selectedMatch} 
        onBack={() => {
          setSelectedMatch(null);
          setActiveTab('matches');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
              Welcome back, {user.first_name || user.firstName}! ✨
            </h1>
            <p className="text-gray-400">
              {matches.length} cosmic connections found for you
            </p>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 bg-slate-800/50 text-gray-300 px-4 py-2 rounded-xl hover:bg-slate-700/50 transition-all"
          >
            <Settings className="w-4 h-4" />
            Profile
          </button>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-800/50 rounded-2xl p-1 flex">
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                activeTab === 'matches'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Heart className="w-5 h-5" />
              Matches ({matches.length})
            </button>
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                activeTab === 'chats'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              Chats
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'matches' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Your Cosmic Matches</h2>
              <button
                onClick={refreshMatches}
                disabled={loading}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card-cosmic animate-pulse">
                    <div className="w-full h-64 bg-gray-700 rounded-xl mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-6 bg-gray-700 rounded"></div>
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-10 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : matches.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((match) => (
                  <EnhancedMatchCard 
                    key={match.user_id} 
                    match={{
                      ...match,
                      age: match.age || new Date().getFullYear() - new Date(match.date_of_birth).getFullYear()
                    }} 
                    onStartChat={() => handleMatchClick(match)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400 mb-2">No matches found yet</h3>
                <p className="text-gray-500 mb-4">
                  We're still calculating your cosmic compatibility with other users.
                </p>
                <button
                  onClick={refreshMatches}
                  className="bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition-all"
                >
                  Check for New Matches
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chats' && !selectedMatch && (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-gray-400 mb-2">No active chats yet</h3>
            <p className="text-gray-500">
              Start a conversation with one of your matches to begin chatting!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
