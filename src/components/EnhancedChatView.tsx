import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ArrowLeft, Send, MapPin, MoreVertical, ShieldOff } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { getSunSign } from '@/utils/astro/zodiacCalculations';
import { useBlock } from '@/hooks/useBlock';
import { BlockUserDialog } from "@/components/BlockUserDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface EnhancedChatViewProps {
  match: any;
  onBack: () => void;
}

const EnhancedChatView = ({ match, onBack }: EnhancedChatViewProps) => {
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const { messages, loading, initializeChat, sendMessage } = useChat();
  const { fetchBlockLists, blockedUserIds, usersWhoBlockedMeIds } = useBlock();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasBeenBlocked = usersWhoBlockedMeIds.includes(match.user_id);
  const haveIBlocked = blockedUserIds.includes(match.user_id);

  const sunSign = match.date_of_birth ? getSunSign(match.date_of_birth) : null;

  const formatSignName = (sign: string | null) => {
    if (!sign) return '';
    return sign.charAt(0).toUpperCase() + sign.slice(1);
  };

  useEffect(() => {
    if (match?.user_id) {
      fetchBlockLists();
      initializeChat(match.user_id);
    }
  }, [match?.user_id, initializeChat, fetchBlockLists]);

  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, blockedUserIds, usersWhoBlockedMeIds]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !hasBeenBlocked && !haveIBlocked) {
      await sendMessage(message);
      setMessage('');
    } else {
      toast({ title: "Cannot send message", description: "Your block status with this user has changed.", variant: "destructive" });
      setMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-slate-900/50 backdrop-blur-sm border-b border-purple-500/20 p-4">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-6 h-6" /></button>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center"><span className="text-white font-semibold">{match.first_name?.[0] || '?'}</span></div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">{match.first_name}, {match.age}</h2>
              {match.place_of_birth && <p className="text-sm text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{match.place_of_birth}</p>}
              {sunSign && <p className="text-sm text-purple-300 font-medium mt-1">☀️ {formatSignName(sunSign)}</p>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button disabled={haveIBlocked || hasBeenBlocked} className="text-gray-400 hover:text-white p-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsBlockDialogOpen(true)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                  <ShieldOff className="mr-2 h-4 w-4" />
                  <span>Block {match.first_name}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto pt-20">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${msg.sender_id === user?.id ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' : 'bg-slate-800 text-gray-200'}`}>
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-purple-100' : 'text-gray-500'}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {hasBeenBlocked ? (
          <div className="bg-slate-900/50 backdrop-blur-sm border-t border-red-500/30 p-4">
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-red-300">{match.first_name} has blocked you. You can no longer send messages in this chat.</p>
            </div>
          </div>
        ) : haveIBlocked ? (
          <div className="bg-slate-900/50 backdrop-blur-sm border-t border-purple-500/20 p-4">
            <div className="max-w-2xl mx-auto text-center"><p className="text-gray-400">You have blocked this user.</p></div>
          </div>
        ) : (
          <div className="bg-slate-900/50 backdrop-blur-sm border-t border-purple-500/20 p-4">
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Message ${match.first_name}...`} className="flex-1 input-cosmic py-3" />
                <button type="submit" disabled={!message.trim()} className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-3 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" /></button>
              </form>
            </div>
          </div>
        )}
      </div>
      {match.user_id && (
        <BlockUserDialog
          open={isBlockDialogOpen}
          onOpenChange={setIsBlockDialogOpen}
          userIdToBlock={match.user_id}
          userName={match.first_name}
          onSuccess={fetchBlockLists}
        />
      )}
    </>
  );
};

export default EnhancedChatView;