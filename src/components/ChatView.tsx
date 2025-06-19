import { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';

interface ChatViewProps {
  match: any;
  onBack: () => void;
}

// Define a type for the messages to ensure consistency
interface ChatMessage {
  id: number;
  text: string;
  sender: 'me' | 'other'; // 'me' for current user, 'other' for match
  created_at: string; // Use ISO string for timestamp
}

const ChatView = ({ match, onBack }: ChatViewProps) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: `Hi ${match.firstName}! I noticed we have amazing cosmic compatibility. I'd love to get to know you better! ✨`,
      sender: 'me',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago, as ISO string
    }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        text: message,
        sender: 'me',
        created_at: new Date().toISOString() // Current time as ISO string
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-purple-500/20 p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <img
            src={match.avatar}
            alt={match.firstName}
            className="w-12 h-12 rounded-full object-cover"
          />
          
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {match.firstName}, {match.age}
            </h2>
            <p className="text-sm text-gray-400">
              {match.compatibility}% cosmic compatibility ✨
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.sender === 'me'
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                    : 'bg-slate-800 text-gray-200'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.sender === 'me' ? 'text-purple-100' : 'text-gray-500'
                  }`}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="text-center py-8">
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 max-w-md mx-auto">
                <h3 className="text-purple-300 font-medium mb-2">🌟 Cosmic Connection</h3>
                <p className="text-gray-400 text-sm">
                  You and {match.firstName} share a {match.compatibility}% astrological compatibility! 
                  Your {match.sunSign} energy complements each other beautifully.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-t border-purple-500/20 p-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message ${match.firstName}...`}
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

export default ChatView;