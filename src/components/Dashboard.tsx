
import { useState } from 'react';
import { Heart, User, MessageSquare } from 'lucide-react';
import MatchCard from '@/components/MatchCard';
import ChatView from '@/components/ChatView';

interface DashboardProps {
  user: any;
}

const Dashboard = ({ user }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'chats'>('matches');
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Mock matches data - in a real app, this would come from the backend
  const mockMatches = [
    {
      id: 1,
      firstName: 'Sarah',
      age: 28,
      location: 'Los Angeles, CA',
      compatibility: 87,
      sunSign: 'Virgo',
      moonSign: 'Cancer',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face'
    },
    {
      id: 2,
      firstName: 'Emma',
      age: 26,
      location: 'San Francisco, CA',
      compatibility: 82,
      sunSign: 'Pisces',
      moonSign: 'Leo',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face'
    },
    {
      id: 3,
      firstName: 'Jessica',
      age: 30,
      location: 'Seattle, WA',
      compatibility: 79,
      sunSign: 'Scorpio',
      moonSign: 'Taurus',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&crop=face'
    }
  ];

  const handleMatchClick = (match: any) => {
    setSelectedMatch(match);
    setActiveTab('chats');
  };

  if (selectedMatch && activeTab === 'chats') {
    return (
      <ChatView 
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
        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Welcome back, {user.firstName}! ✨
          </h1>
          <p className="text-gray-400">
            {user.matchesFound} cosmic connections waiting for you
          </p>
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
              Matches
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockMatches.map((match) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                onClick={() => handleMatchClick(match)}
              />
            ))}
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
