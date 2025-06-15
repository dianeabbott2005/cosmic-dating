
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'registration' | 'dashboard'>('welcome');
  const [user, setUser] = useState(null);
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser) {
      // Check if user has completed registration
      setCurrentView('dashboard');
    }
  }, [authUser]);

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
    setCurrentView('welcome');
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
