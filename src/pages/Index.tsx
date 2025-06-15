
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
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const initializeView = async () => {
      setLoading(true);
      
      if (authUser) {
        console.log('Auth user found:', authUser.id);
        // Check if user has completed registration by checking for profile
        await checkUserProfile();
      } else {
        console.log('No auth user');
        // Check if this is a new signup redirect
        const isRegistering = searchParams.get('register');
        if (isRegistering) {
          console.log('Registration redirect detected');
          setCurrentView('registration');
        } else {
          setCurrentView('welcome');
        }
      }
      
      setLoading(false);
    };

    initializeView();
  }, [authUser, searchParams]);

  const checkUserProfile = async () => {
    if (!authUser) return;

    try {
      console.log('Checking profile for user:', authUser.id);
      
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      console.log('Profile check result:', { profile: userProfile, error });

      if (error) {
        console.error('Error checking profile:', error);
        setCurrentView('registration');
        return;
      }
      
      setProfile(userProfile);

      if (!userProfile || !userProfile.first_name || !userProfile.last_name) {
        console.log('No complete profile found, showing registration');
        // No profile found or incomplete profile, show registration
        setCurrentView('registration');
      } else {
        console.log('Complete profile found, showing dashboard');
        // Profile exists and is complete, show dashboard
        setCurrentView('dashboard');
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      setCurrentView('registration');
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
      // If user is logged in, they shouldn't go back to welcome
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
