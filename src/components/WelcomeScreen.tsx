
import { Heart, User, MessageCircle } from 'lucide-react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Floating cosmic elements */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-blue-400 rounded-full animate-pulse opacity-80"></div>
        <div className="absolute bottom-40 left-20 w-3 h-3 bg-gold-400 rounded-full animate-pulse opacity-40"></div>
        
        {/* Main content */}
        <div className="animate-float">
          <div className="relative">
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-6">
              Cosmic
            </h1>
            <div className="flex items-center justify-center gap-3 mb-8">
              <Heart className="w-8 h-8 text-pink-400 animate-pulse" />
              <span className="text-2xl md:text-3xl text-gold-400 font-semibold">
                Love Beyond Sight
              </span>
              <Heart className="w-8 h-8 text-pink-400 animate-pulse" />
            </div>
          </div>
        </div>

        <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto">
          Welcome to a dating experience where connections are sparked by 
          <span className="text-purple-400 font-semibold"> celestial alignment, not selfies</span>. 
          Get to know the real person through planetary alignments and meaningful conversation.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
          <div className="card-cosmic text-center">
            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Your Cosmic Blueprint</h3>
            <p className="text-gray-400 text-sm">Create your profile with birth details. No photos, just your unique planetary alignment.</p>
          </div>

          <div className="card-cosmic text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Astrological Matching</h3>
            <p className="text-gray-400 text-sm">Our AI discovers deeply compatible souls based on detailed birth chart analysis.</p>
          </div>

          <div className="card-cosmic text-center">
            <div className="w-16 h-16 bg-pink-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Meaningful Connections</h3>
            <p className="text-gray-400 text-sm">Chat with matches and let your personalities shine. Find love that's written in the stars.</p>
          </div>
        </div>

        <button 
          onClick={onGetStarted}
          className="btn-cosmic text-xl px-12 py-4 animate-pulse-glow"
        >
          Begin Your Cosmic Journey
        </button>

        <p className="text-gray-500 text-sm mt-6">
          Join thousands discovering love through the stars ✨
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
