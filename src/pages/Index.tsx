
import { useState } from 'react';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'registration' | 'dashboard'>('welcome');
  const [user, setUser] = useState(null);

  const handleGetStarted = () => {
    setCurrentView('registration');
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
        <Dashboard user={user} />
      )}
    </div>
  );
};

export default Index;
