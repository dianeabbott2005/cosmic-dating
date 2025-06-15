
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      navigate('/');
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/?register=true`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setError(error.message || 'An error occurred with Google sign-up');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen cosmic-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <div className="card-cosmic">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Welcome Back' : 'Join the Cosmos'}
            </h1>
            <p className="text-gray-400">
              {isLogin ? 'Sign in to find your cosmic match' : 'Create your astrological profile'}
            </p>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {isLogin ? (
            // Login Form
            <form onSubmit={handleEmailLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-cosmic w-full"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-cosmic w-full"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-cosmic w-full"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            // Sign Up Section
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-300 mb-6">
                  Create your account using Google to get started
                </p>
              </div>

              <button
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Creating account...' : 'Continue with Google'}
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-purple-400 hover:text-purple-300 transition-colors"
              disabled={loading}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
