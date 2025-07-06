import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import ConsentScreen from '@/components/ConsentScreen';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useUserLocation } from '@/hooks/useUserLocation';
import { requestNotificationPermission } from '@/utils/notifier';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'consent' | 'registration' | 'dashboard'>('welcome');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUserId = authUser?.id;

  useUserLocation();

  useEffect(() => {
    const initializeView = async () => {
      setLoading(true);
      setError(null);
      
      if (authUserId) {
        console.log('Index.tsx: Auth user found:', authUserId);
        await requestNotificationPermission();
        await checkUserProfile();
      } else {
        console.log('Index.tsx: No auth user');
        const isRegistering = searchParams.get('register');
        if (isRegistering) {
          console.log('Index.tsx: Registration redirect detected, but no auth user. Redirecting to auth.');
          navigate('/auth');
        } else {
          console.log('Index.tsx: Setting view to welcome (no auth user, no registration param).');
          setCurrentView('welcome');
        }
      }
      setLoading(false);
    };

    initializeView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, searchParams]);

  const checkUserProfile = async () => {
    if (!authUserId) return;

    console.log('Index.tsx: Introducing initial delay before profile fetch...');
    await new Promise(resolve => setTimeout(resolve, 500));

    let userProfile: Database['public']['Tables']['profiles']['Row'] | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 1000;

    while (!userProfile && attempts < MAX_ATTEMPTS) {
      if (attempts > 0) {
        console.log(`Index.tsx: Retrying fetch for user profile (${attempts}/${MAX_ATTEMPTS})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
      try {
        const { data, error: dbError } = await supabase
          .from('profiles')
          .select(`*`)
          .eq('user_id', authUserId)
          .maybeSingle();

        if (dbError && dbError.code !== 'PGRST116') {
          console.error('Index.tsx: Error checking profile:', dbError);
          setError(dbError.message);
          break;
        }
        userProfile = data;
      } catch (err) {
        console.error('Index.tsx: Unexpected error during profile fetch attempt:', err);
        setError('Failed to fetch profile due to an unexpected error.');
        break;
      }
      attempts++;
    }

    if (error) {
      console.log('Index.tsx: Error state detected, falling back to registration view.');
      setProfile(null);
      setCurrentView('registration');
      return;
    }
      
    setProfile(userProfile);
    console.log('Index.tsx: Fetched user profile:', userProfile);

    const requiredFields = [
      'first_name', 'last_name', 'email', 'date_of_birth', 'time_of_birth',
      'place_of_birth', 'latitude', 'longitude', 'gender',
      'looking_for', 'min_age', 'max_age'
    ];

    const isProfileComplete = userProfile && 
                              userProfile.is_active === false &&
                              requiredFields.every(field => {
      const value = userProfile[field as keyof typeof userProfile];
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return value !== null && value !== undefined;
    });

    console.log('Index.tsx: isProfileComplete check result:', isProfileComplete);
    console.log('Index.tsx: has_agreed_to_terms status:', userProfile?.has_agreed_to_terms);

    if (!userProfile || userProfile.has_agreed_to_terms === false) {
      console.log('Index.tsx: User has not agreed to terms or profile is missing, showing consent screen.');
      setCurrentView('consent');
    } else if (isProfileComplete) {
      console.log('Index.tsx: Complete profile found and terms agreed, showing dashboard.');
      setCurrentView('dashboard');
    } else {
      console.log('Index.tsx: Incomplete profile found but terms agreed, showing registration.');
      setCurrentView('registration');
    }
  };

  const handleGetStarted = () => {
    if (authUserId) {
      console.log('Index.tsx: Get Started clicked with auth user, directing to consent screen.');
      setCurrentView('consent');
    } else {
      console.log('Index.tsx: Get Started clicked without auth user, navigating to auth.');
      navigate('/auth');
    }
  };

  const handleConsentAgree = () => {
    console.log('Index.tsx: Consent agreed, re-checking user profile.');
    checkUserProfile();
  };

  const handleRegistrationComplete = (userData: any) => {
    console.log('Index.tsx: Registration completed, setting view to dashboard.');
    setProfile(userData);
    setCurrentView('dashboard');
  };

  const handleBackToWelcome = () => {
    console.log('Index.tsx: Back button clicked from registration flow.');
    if (authUserId) {
      checkUserProfile(); 
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
  };

  return (
    <div className="min-h-screen cosmic-bg">
      {currentView === 'welcome' && (
        <WelcomeScreen onGetStarted={handleGetStarted} />
      )}
      
      {currentView === 'consent' && authUser && (
        <ConsentScreen onAgree={handleConsentAgree} />
      )}

      {currentView === 'registration' && authUser && (
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