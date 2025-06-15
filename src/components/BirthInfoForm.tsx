
import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface BirthInfoFormProps {
  onNext: (data: any) => void;
  userData: any;
}

const BirthInfoForm = ({ onNext, userData }: BirthInfoFormProps) => {
  const [formData, setFormData] = useState({
    dateOfBirth: userData.dateOfBirth || '',
    timeOfBirth: userData.timeOfBirth || '',
    placeOfBirth: userData.placeOfBirth || '',
    ...userData
  });

  const [errors, setErrors] = useState<any>({});

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }
    
    if (!formData.timeOfBirth) {
      newErrors.timeOfBirth = 'Time of birth is required for accurate charts';
    }
    
    if (!formData.placeOfBirth.trim()) {
      newErrors.placeOfBirth = 'Place of birth is required';
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Your Cosmic Blueprint</h3>
        <p className="text-gray-400">We need your birth details to create your accurate astrological chart</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Date of Birth *
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          className={`input-cosmic w-full ${errors.dateOfBirth ? 'border-red-500' : ''}`}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
        />
        {errors.dateOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.dateOfBirth}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Time of Birth *
        </label>
        <input
          type="time"
          value={formData.timeOfBirth}
          onChange={(e) => handleInputChange('timeOfBirth', e.target.value)}
          className={`input-cosmic w-full ${errors.timeOfBirth ? 'border-red-500' : ''}`}
        />
        <p className="text-gray-500 text-xs mt-1">
          Check your birth certificate for the most accurate time
        </p>
        {errors.timeOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.timeOfBirth}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Place of Birth *
        </label>
        <input
          type="text"
          value={formData.placeOfBirth}
          onChange={(e) => handleInputChange('placeOfBirth', e.target.value)}
          className={`input-cosmic w-full ${errors.placeOfBirth ? 'border-red-500' : ''}`}
          placeholder="e.g., New York, NY, USA"
        />
        <p className="text-gray-500 text-xs mt-1">
          Include city, state/province, and country for best results
        </p>
        {errors.placeOfBirth && (
          <p className="text-red-400 text-sm mt-1">{errors.placeOfBirth}</p>
        )}
      </div>

      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
        <h4 className="text-purple-300 font-medium mb-2">Why do we need this?</h4>
        <p className="text-gray-400 text-sm">
          Your exact birth time and location create your unique astrological fingerprint. 
          This allows us to calculate precise planetary positions and find your most compatible matches.
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
