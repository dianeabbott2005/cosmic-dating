
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'registration' | 'dashboard'>('welcome');
  const [user, setUser] = useState(null);
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (authUser) {
      // Check if user has completed registration by checking for profile
      checkUserProfile();
    } else {
      // Check if this is a new signup redirect
      const isRegistering = searchParams.get('register');
      if (isRegistering) {
        setCurrentView('registration');
      } else {
        setCurrentView('welcome');
      }
    }
  }, [authUser, searchParams]);

  const checkUserProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single();

      if (error || !profile) {
        // No profile found, show registration
        setCurrentView('registration');
      } else {
        // Profile exists, show dashboard
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
    setUser(userData);
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

      {currentView === 'dashboard' && (
        <Dashboard user={user || authUser} />
      )}
    </div>
  );
};

export default Index;
