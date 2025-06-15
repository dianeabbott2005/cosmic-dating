
import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileCompleteProps {
  onNext: (data: any) => void;
  userData: any;
}

const ProfileComplete = ({ onNext, userData }: ProfileCompleteProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateProfile = async () => {
    setIsCreating(true);
    
    try {
      console.log('Creating profile with userData:', userData);
      
      // Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password || 'tempPassword123!', // You should collect this in registration
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            date_of_birth: userData.dateOfBirth,
            time_of_birth: userData.timeOfBirth,
            place_of_birth: userData.placeOfBirth,
            gender: userData.gender,
            looking_for: userData.lookingFor,
            min_age: userData.minAge,
            max_age: userData.maxAge
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      console.log('Auth user created:', authData.user?.id);

      // The profile should be automatically created by the trigger
      // But let's also geocode the location if needed
      if (userData.placeOfBirth && (!userData.latitude || !userData.longitude)) {
        try {
          const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke('geocode', {
            body: { address: userData.placeOfBirth }
          });

          if (!geocodeError && geocodeData?.results?.[0]) {
            const location = geocodeData.results[0];
            
            // Update the profile with coordinates
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                latitude: location.latitude,
                longitude: location.longitude
              })
              .eq('user_id', authData.user?.id);

            if (updateError) {
              console.error('Error updating coordinates:', updateError);
            }
          }
        } catch (geocodeError) {
          console.error('Geocoding failed:', geocodeError);
          // Continue anyway, coordinates are not critical
        }
      }

      toast({
        title: "Profile Created Successfully!",
        description: "Welcome to your cosmic dating journey.",
      });

      // Complete the registration process
      onNext({ success: true });

    } catch (error: any) {
      console.error('Error creating profile:', error);
      toast({
        title: "Error Creating Profile",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Complete Your Profile</h3>
        <p className="text-gray-400">
          Ready to find your cosmic connection? Let's create your profile!
        </p>
      </div>

      {/* Profile Summary */}
      <div className="bg-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="text-lg font-medium text-white mb-4">Profile Summary</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Name:</span>
            <p className="text-white">{userData.firstName} {userData.lastName}</p>
          </div>
          <div>
            <span className="text-gray-400">Email:</span>
            <p className="text-white">{userData.email}</p>
          </div>
          <div>
            <span className="text-gray-400">Gender:</span>
            <p className="text-white capitalize">{userData.gender}</p>
          </div>
          <div>
            <span className="text-gray-400">Looking for:</span>
            <p className="text-white capitalize">{userData.lookingFor}</p>
          </div>
          <div>
            <span className="text-gray-400">Birth Date:</span>
            <p className="text-white">{userData.dateOfBirth}</p>
          </div>
          <div>
            <span className="text-gray-400">Birth Time:</span>
            <p className="text-white">{userData.timeOfBirth}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Birth Place:</span>
            <p className="text-white">{userData.placeOfBirth}</p>
          </div>
          <div>
            <span className="text-gray-400">Age Range:</span>
            <p className="text-white">{userData.minAge} - {userData.maxAge} years</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateProfile}
        disabled={isCreating}
        className="btn-cosmic w-full flex items-center justify-center gap-2"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating Your Profile...
          </>
        ) : (
          'Create My Profile'
        )}
      </button>
    </div>
  );
};

export default ProfileComplete;
