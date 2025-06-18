import { useState, useEffect } => 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WelcomeScreen from '@/components/WelcomeScreen';
import RegistrationFlow from '@/components/RegistrationFlow';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useMatches } from '@/hooks/useMatches'; // Import useMatches

const Index = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'registration' | 'dashboard'>('welcome');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Database['public']['Tables']['profiles']['Row'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshMatches } = useMatches(); // Get refreshMatches from useMatches

  useEffect(() => {
    const initializeView = async () => {
      setLoading(true);
      setError(null);
      
      if (authUser) {
        console.log('Auth user found:', authUser.id);
        // If we are already on the dashboard and have a profile, no need to re-check from DB
        if (currentView === 'dashboard' && profile) {
          console.log('Already on dashboard with profile, skipping DB check.');
        } else {
          // Otherwise, check the user profile from DB
          await checkUserProfile();
        }
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
      setLoading(false);
    };

    initializeView();
  }, [authUser, searchParams]); // Removed 'currentView' and 'profile' from dependencies

  const checkUserProfile = async () => {
    if (!authUser) return;

    try {
      console.log('Checking profile for user:', authUser.id);
      
      const { data: userProfile, error: dbError } = await supabase
        .from('profiles')
        .select(`
          created_at, date_of_birth, email, first_name, gender, id, last_name,
          latitude, longitude, looking_for, max_age, min_age, personality_prompt,
          place_of_birth, time_of_birth, updated_at, user_id, timezone, is_active
        `) // Explicitly select fields, including is_active
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

      if (isProfileComplete) {
        console.log('Complete profile found, showing dashboard');
        setCurrentView('dashboard');
        // Trigger match generation after a complete profile is found
        refreshMatches(); 
      } else {
        console.log('Incomplete profile found, showing registration');
        setCurrentView('registration');
      }
    } catch (error: any) {
      console.error('Error in checkUserProfile catch block:', error);
      setProfile(null);
      setCurrentView('registration');
      throw error;
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
    setProfile(userData); // Set the profile state directly from the completed data
    setCurrentView('dashboard'); // Transition to dashboard

    // Re-check completeness of the just-submitted userData
    const requiredFields = [
      'first_name', 'last_name', 'email', 'date_of_birth', 'time_of_birth',
      'place_of_birth', 'latitude', 'longitude', 'gender',
      'looking_for', 'min_age', 'max_age'
    ];
    const isSubmittedProfileComplete = userData && 
                                       userData.is_active === false && // Human profiles should have is_active: false
                                       requiredFields.every(field => {
      const value = userData[field as keyof typeof userData];
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return value !== null && value !== undefined;
    });
    console.log('handleRegistrationComplete: Is submitted profile complete?', isSubmittedProfileComplete, 'Submitted data:', userData); // ADDED LOG

    refreshMatches();
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

      {currentView === 'dashboard' && profile && (
        <Dashboard user={profile} />
      )}
    </div>
  );
};

export default Index;