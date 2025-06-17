import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'registration' | 'dashboard'>('welcome');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [error, setError] = useState<string | null>(null); // New state for error
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const initializeView = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      
      try {
        if (authUser) {
          console.log('Auth user found:', authUser.id);
          await checkUserProfile();
        } else {
          console.log('No auth user');
          const isRegistering = searchParams.get('register');
          if (isRegistering) {
            console.log('Registration redirect detected');
            setCurrentView('registration');
          } else {
            setCurrentView('welcome');
          }
        }
      } catch (err: any) {
        console.error('Error during view initialization:', err);
        setError(err.message || 'An unexpected error occurred during initialization.');
        setCurrentView('welcome'); // Fallback to welcome or an error screen
      } finally {
        setLoading(false);
      }
    };

    initializeView();
  }, [authUser, searchParams]);

  const checkUserProfile = async () => {
    if (!authUser) return;

    try {
      console.log('Checking profile for user:', authUser.id);
      
      const { data: userProfile, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      console.log('Profile check result:', { profile: userProfile, error: dbError });

      if (dbError) {
        console.error('Error checking profile:', dbError);
        setProfile(null);
        setCurrentView('registration');
        return;
      }
      
      setProfile(userProfile);

      if (userProfile && userProfile.first_name && userProfile.last_name) {
        console.log('Complete profile found, showing dashboard');
        setCurrentView('dashboard');
      } else {
        console.log('No complete profile found, showing registration');
        setCurrentView('registration');
      }
    } catch (error: any) {
      console.error('Error in checkUserProfile catch block:', error);
      setProfile(null);
      setCurrentView('registration');
      throw error; // Re-throw to be caught by the outer initializeView try-catch
    }
  };

  const handleGetStarted = () => {
    if (authUser) {
      setCurrentView('registration');
    } else {
      navigate('/auth');
    }
  };

  const handleRegistrationComplete = (userData: any) => {
    console.log('Registration completed:', userData);
    setProfile(userData);
    setCurrentView('dashboard');
  };

  const handleBackToWelcome = () => {
    if (authUser) {
      setCurrentView('registration');
    } else {
      setCurrentView('welcome');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center p-4">
        <div className="card-cosmic text-center p-8">
          <h2 className="text-xl font-bold text-red-400 mb-4">Error Loading Application</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-cosmic"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen cosmic-bg">
      {currentView === 'welcome' && (
        <WelcomeScreen onGetStarted={handleGetStarted} />
      )}
      
      {currentView === 'registration' && (
        <RegistrationFlow 
          onComplete={handleRegistrationComplete}
          onBack={handleBackToWelcome}
        />
      )}

      {currentView === 'dashboard' && profile && (
        <Dashboard user={profile} />
      )}
    </div>
  );
};

export default Index;