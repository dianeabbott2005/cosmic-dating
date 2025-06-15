import { useState, useEffect } from 'react';
import { Heart, User, MessageSquare, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EnhancedMatchCard from '@/components/EnhancedMatchCard';
import EnhancedChatView from '@/components/EnhancedChatView';
import { useMatches } from '@/hooks/useMatches';
import { useChat } from '@/hooks/useChat';

interface DashboardProps {
  user: any;
}

const Dashboard = ({ user }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'chats'>('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const { matches, loading, refreshMatches } = useMatches();
  const { chats, loadUserChats } = useChat();
  const navigate = useNavigate();

  // Load user chats when component mounts or when switching to chats tab
  useEffect(() => {
    if (activeTab === 'chats') {
      loadUserChats();
    }
  }, [activeTab]);

  const handleMatchClick = (match: any) => {
    setSelectedMatch(match);
    setActiveTab('chats');
  };

  const handleChatClick = (chat: any) => {
    // Convert chat to match-like object for EnhancedChatView
    const matchFromChat = {
      user_id: chat.other_user?.user_id,
      first_name: chat.other_user?.first_name,
      firstName: chat.other_user?.first_name,
      age: 25, // Default age since we don't have it in chat
      place_of_birth: chat.other_user?.place_of_birth,
    };
    setSelectedMatch(matchFromChat);
  };

  if (selectedMatch && activeTab === 'chats') {
    return (
      <EnhancedChatView 
        match={selectedMatch} 
        onBack={() => {
          setSelectedMatch(null);
          setActiveTab('chats');
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
              Chats ({chats.length})
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
                      age: match.age // Use the calculated age from useMatches
                    }} 
                    onStartChat={() => handleMatchClick(match)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400 mb-2">No Cosmic Matches Yet</h3>
                <p className="text-gray-500 mb-4">
                  The universe is working its magic to find connections based on your unique astral signature. Check back soon!
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
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Your Conversations</h2>
              <button
                onClick={loadUserChats}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {chats.length > 0 ? (
              <div className="space-y-4">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleChatClick(chat)}
                    className="card-cosmic p-4 cursor-pointer hover:bg-slate-800/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {chat.other_user?.first_name?.[0] || '?'}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">
                          {chat.other_user?.first_name} {chat.other_user?.last_name}
                        </h3>
                        {chat.last_message && (
                          <p className="text-gray-400 text-sm truncate">
                            {chat.last_message.content}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs">
                          {new Date(chat.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <MessageSquare className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl text-gray-400 mb-2">No Conversations Started</h3>
                <p className="text-gray-500">
                  Found a compelling cosmic connection? Break the ice and let your personalities align!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
