
import { useState } from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import PlaceSearch from '@/components/PlaceSearch';

interface BirthInfoFormProps {
  onNext: (data: any) => void;
  userData: any;
}

const BirthInfoForm = ({ onNext, userData }: BirthInfoFormProps) => {
  const [formData, setFormData] = useState({
    dateOfBirth: userData.dateOfBirth || '',
    timeOfBirth: userData.timeOfBirth || '',
    placeOfBirth: userData.placeOfBirth || '',
    latitude: userData.latitude || null,
    longitude: userData.longitude || null,
    ...userData
  });

  const [errors, setErrors] = useState<any>({});

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
    }
    
    if (!formData.timeOfBirth) {
      newErrors.timeOfBirth = 'Time of birth is required for accurate astrological calculations';
    }
    
    if (!formData.placeOfBirth) {
      newErrors.placeOfBirth = 'Place of birth is required for astrological calculations';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onNext(formData);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handlePlaceSelect = (place: { name: string; latitude: number; longitude: number }) => {
    setFormData({
      ...formData,
      placeOfBirth: place.name,
      latitude: place.latitude,
      longitude: place.longitude
    });
    if (errors.placeOfBirth) {
      setErrors({ ...errors, placeOfBirth: '' });
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  const maxDate = eighteenYearsAgo.toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Birth Information</h3>
        <p className="text-gray-400">Help us create your cosmic profile with accurate birth details</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Date of Birth *
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            max={maxDate}
            className={`input-cosmic w-full pl-12 ${errors.dateOfBirth ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.dateOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.dateOfBirth}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Time of Birth *
        </label>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="time"
            value={formData.timeOfBirth}
            onChange={(e) => handleInputChange('timeOfBirth', e.target.value)}
            className={`input-cosmic w-full pl-12 ${errors.timeOfBirth ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.timeOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.timeOfBirth}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          Even an approximate time helps with accuracy
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Place of Birth *
        </label>
        <PlaceSearch
          onPlaceSelect={handlePlaceSelect}
          placeholder="Search for your birth city..."
          value={formData.placeOfBirth}
        />
        {errors.placeOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.placeOfBirth}</p>
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-4">
        <h4 className="text-blue-300 font-medium mb-2">🔮 Why We Need This</h4>
        <p className="text-gray-400 text-sm">
          Your exact birth time and location are crucial for creating an accurate natal chart. 
          This allows us to calculate precise planetary positions and provide the most accurate 
          compatibility matches based on real astrological principles.
        </p>
      </div>

      <button
        type="submit"
        className="btn-cosmic w-full mt-8"
      >
        Continue to Preferences
      </button>
    </form>
  );
};

export default BirthInfoForm;
