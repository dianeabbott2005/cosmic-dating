import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, MapPin } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { getSunSign } from '@/utils/astro/zodiacCalculations'; // Import getSunSign

interface EnhancedChatViewProps {
  match: any;
  onBack: () => void;
}

const EnhancedChatView = ({ match, onBack }: EnhancedChatViewProps) => {
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const { chat, messages, loading, initializeChat, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Calculate sun sign
  const sunSign = match.date_of_birth ? getSunSign(match.date_of_birth) : null;

  const formatSignName = (sign: string | null) => {
    if (!sign) return '';
    return sign.charAt(0).toUpperCase() + sign.slice(1);
  };

  useEffect(() => {
    if (match?.user_id) {
      initializeChat(match.user_id);
    }
  }, [match?.user_id]);

  useEffect(() => {
    console.log('EnhancedChatView: Messages state updated:', messages.length, 'messages');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      await sendMessage(message);
      setMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    // Updated to include seconds
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Made sticky */}
      <div className="sticky top-0 z-10 bg-slate-900/50 backdrop-blur-sm border-b border-purple-500/20 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">
              {match.first_name?.[0] || match.firstName?.[0] || '?'}
            </span>
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {match.first_name || match.firstName}, {match.age}
            </h2>
            {match.place_of_birth && (
              <p className="text-sm text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {match.place_of_birth}
              </p>
            )}
            {sunSign && (
              <p className="text-sm text-purple-300 font-medium mt-1">
                ☀️ {formatSignName(sunSign)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages - Added padding-top to account for sticky header */}
      <div className="flex-1 p-4 overflow-y-auto pt-20"> {/* Increased padding-top */}
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 max-w-md mx-auto">
                <h3 className="text-purple-300 font-medium mb-2">🌟 A Cosmic Connection Awaits</h3>
                <p className="text-gray-400 text-sm">
                  The stars have aligned for you and {match.first_name || match.firstName}.
                  This is where your journey beyond the superficial begins. What will you discover about your cosmic connection?
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.sender_id === user?.id
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'bg-slate-800 text-gray-200'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.sender_id === user?.id ? 'text-purple-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-t border-purple-500/20 p-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message ${match.first_name || match.firstName}...`}
              className="flex-1 input-cosmic py-3"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-3 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EnhancedChatView;