import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import ConsentScreen from '@/components/ConsentScreen';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'consent' | 'registration' | 'dashboard'>('welcome');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUserId = authUser?.id;

  useEffect(() => {
    const initializeView = async () => {
      setLoading(true);
      setError(null);
      
      if (authUserId) {
        console.log('Index.tsx: Auth user found:', authUserId);
        await checkUserProfile();
      } else {
        console.log('Index.tsx: No auth user');
        const isRegistering = searchParams.get('register');
        if (isRegistering) {
          console.log('Index.tsx: Registration redirect detected, but no auth user. Redirecting to auth.');
          navigate('/auth'); // Ensure user is authenticated before registration flow
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

    // Add a small initial delay to allow Supabase triggers to complete
    console.log('Index.tsx: Introducing initial delay before profile fetch...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 0.5 seconds

    let userProfile: Database['public']['Tables']['profiles']['Row'] | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 1000; // 1 second

    while (!userProfile && attempts < MAX_ATTEMPTS) {
      if (attempts > 0) {
        console.log(`Index.tsx: Retrying fetch for user profile (${attempts}/${MAX_ATTEMPTS})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
      try {
        const { data, error: dbError } = await supabase
          .from('profiles')
          .select(`
            created_at, date_of_birth, email, first_name, gender, id, last_name,
            latitude, longitude, looking_for, max_age, min_age, personality_prompt,
            place_of_birth, time_of_birth, updated_at, user_id, timezone, is_active,
            has_agreed_to_terms
          `)
          .eq('user_id', authUserId)
          .maybeSingle();

        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "No rows found"
          console.error('Index.tsx: Error checking profile:', dbError);
          setError(dbError.message);
          break; // Break on actual database errors
        }
        userProfile = data;
      } catch (err) {
        console.error('Index.tsx: Unexpected error during profile fetch attempt:', err);
        setError('Failed to fetch profile due to an unexpected error.');
        break;
      }
      attempts++;
    }

    if (error) { // If an error occurred during fetching
      console.log('Index.tsx: Error state detected, falling back to registration view.');
      setProfile(null);
      setCurrentView('registration'); // Fallback to registration if profile fetch fails
      return;
    }
      
    setProfile(userProfile);
    console.log('Index.tsx: Fetched user profile:', userProfile);

    // Define all required fields for a complete profile
    const requiredFields = [
      'first_name', 'last_name', 'email', 'date_of_birth', 'time_of_birth',
      'place_of_birth', 'latitude', 'longitude', 'gender',
      'looking_for', 'min_age', 'max_age'
    ];

    // Check if all required fields are present and not null/empty, AND if is_active is explicitly false (for human profiles)
    const isProfileComplete = userProfile && 
                              userProfile.is_active === false && // Human profiles should have is_active: false
                              requiredFields.every(field => {
      const value = userProfile[field as keyof typeof userProfile];
      // For string fields, check if it's not an empty string
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      // For number/boolean fields, check if it's not null or undefined
      return value !== null && value !== undefined;
    });

    console.log('Index.tsx: isProfileComplete check result:', isProfileComplete);
    console.log('Index.tsx: has_agreed_to_terms status:', userProfile?.has_agreed_to_terms);

    // New logic: Check consent first
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
      setCurrentView('consent'); // Always go to consent if authenticated
    } else {
      console.log('Index.tsx: Get Started clicked without auth user, navigating to auth.');
      navigate('/auth');
    }
  };

  const handleConsentAgree = () => {
    console.log('Index.tsx: Consent agreed, re-checking user profile.');
    // After agreeing to terms, proceed to check profile completeness
    checkUserProfile();
  };

  const handleRegistrationComplete = (userData: any) => {
    console.log('Index.tsx: Registration completed, setting view to dashboard.');
    setProfile(userData); // Set the profile state directly from the completed data
    setCurrentView('dashboard'); // Transition to dashboard
  };

  const handleBackToWelcome = () => {
    console.log('Index.tsx: Back button clicked from registration flow.');
    if (authUserId) {
      // If user is logged in, going back from registration means they might need to re-agree or complete profile
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