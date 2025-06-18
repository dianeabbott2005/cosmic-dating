import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlaceSearch from '@/components/PlaceSearch';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { useMatches } from '@/hooks/useMatches'; // Import useMatches

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { getTimezone } = useGoogleMaps();
  const { refreshMatches } = useMatches(); // Get refreshMatches from useMatches
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    time_of_birth: '',
    place_of_birth: '',
    latitude: null as number | null,
    longitude: null as number | null,
    timezone: null as string | null,
    gender: '',
    looking_for: '',
    min_age: 18,
    max_age: 35,
    is_active: false, // Default to false for human profiles
  });

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          created_at, date_of_birth, email, first_name, gender, id, last_name,
          latitude, longitude, looking_for, max_age, min_age, personality_prompt,
          place_of_birth, time_of_birth, updated_at, user_id, timezone, is_active
        `) // Explicitly select fields, including is_active
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setProfile({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          date_of_birth: data.date_of_birth,
          time_of_birth: data.time_of_birth,
          place_of_birth: data.place_of_birth,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
          gender: data.gender,
          looking_for: data.looking_for,
          min_age: data.min_age,
          max_age: data.max_age,
          is_active: data.is_active ?? false, // Use existing value or default to false
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = (place: { name: string; latitude: number; longitude: number }) => {
    console.log('Place selected:', place);
    setProfile(prev => ({
      ...prev,
      place_of_birth: place.name,
      latitude: place.latitude,
      longitude: place.longitude
    }));
  };

  const saveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      let currentLatitude = profile.latitude;
      let currentLongitude = profile.longitude;
      let currentPlaceOfBirth = profile.place_of_birth;
      let currentReadonlyTimezone = profile.timezone;

      if (currentPlaceOfBirth && currentLatitude && currentLongitude) {
        try {
          const timezoneResult = await getTimezone(currentLatitude, currentLongitude);
          if (timezoneResult) {
            currentReadonlyTimezone = timezoneResult.timezoneId;
            console.log('Timezone re-fetched automatically:', currentReadonlyTimezone);
          } else {
            console.warn('Could not automatically determine timezone for coordinates:', { currentLatitude, currentLongitude });
            currentReadonlyTimezone = null; // Explicitly set to null if not found
          }
        } catch (timezoneError) {
          console.error('Error re-fetching timezone automatically:', timezoneError);
          currentReadonlyTimezone = null; // Explicitly set to null on error
        }
      }

      console.log('Saving profile with coordinates and timezone:', {
        place_of_birth: currentPlaceOfBirth,
        latitude: currentLatitude,
        longitude: currentLongitude,
        timezone: currentReadonlyTimezone
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          date_of_birth: profile.date_of_birth,
          time_of_birth: profile.time_of_birth,
          place_of_birth: currentPlaceOfBirth,
          latitude: currentLatitude,
          longitude: currentLongitude,
          timezone: currentReadonlyTimezone,
          gender: profile.gender,
          looking_for: profile.looking_for,
          min_age: profile.min_age,
          max_age: profile.max_age,
          is_active: profile.is_active, // Include is_active in update
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setProfile(prev => ({ ...prev, timezone: currentReadonlyTimezone }));

      console.log('Profile updated successfully with coordinates and timezone');
      alert('Profile updated successfully!');
      refreshMatches(); // Trigger match generation after profile update
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pt-8">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Profile Settings
          </h1>
        </div>

        {/* Profile Form */}
        <div className="card-cosmic">
          <div className="grid gap-6">
            {/* Personal Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  className="input-cosmic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  className="input-cosmic"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="input-cosmic"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Birth Info */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={profile.date_of_birth}
                  onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                  className="input-cosmic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time of Birth
                </label>
                <input
                  type="time"
                  value={profile.time_of_birth}
                  onChange={(e) => setProfile({ ...profile, time_of_birth: e.target.value })}
                  className="input-cosmic"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Place of Birth
                </label>
                <PlaceSearch
                  onPlaceSelect={handlePlaceSelect}
                  value={profile.place_of_birth}
                  placeholder="Search for your birth place..."
                />
                {profile.latitude && profile.longitude && (
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timezone (Automatically determined)
              </label>
              <input
                type="text"
                value={profile.timezone || 'Fetching...'}
                className="input-cosmic bg-gray-800/50 cursor-not-allowed"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                This is automatically determined from your place of birth.
              </p>
            </div>

            {/* Gender & Preferences */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gender
                </label>
                <select
                  value={profile.gender}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  className="input-cosmic"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Looking For
                </label>
                <select
                  value={profile.looking_for}
                  onChange={(e) => setProfile({ ...profile, looking_for: e.target.value })}
                  className="input-cosmic"
                >
                  <option value="">Select preference</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
            </div>

            {/* Age Preferences */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Min Age
                </label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.min_age}
                  onChange={(e) => setProfile({ ...profile, min_age: parseInt(e.target.value) })}
                  className="input-cosmic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Age
                </label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.max_age}
                  onChange={(e) => setProfile({ ...profile, max_age: parseInt(e.target.value) })}
                  className="input-cosmic"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 rounded-xl font-medium hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={signOut}
                className="px-6 py-3 border border-red-500 text-red-400 rounded-xl hover:bg-red-500/10 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;