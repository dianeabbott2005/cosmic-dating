
import { useState } from 'react';
import { Heart } from 'lucide-react';

interface PreferencesFormProps {
  onNext: (data: any) => void;
  userData: any;
}

const PreferencesForm = ({ onNext, userData }: PreferencesFormProps) => {
  const [formData, setFormData] = useState({
    lookingFor: userData.lookingFor || '',
    minAge: userData.minAge || 22,
    maxAge: userData.maxAge || 35,
    ...userData
  });

  const [errors, setErrors] = useState<any>({});

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!formData.lookingFor) {
      newErrors.lookingFor = 'Please select who you\'re looking for';
    }
    
    if (formData.minAge < 18) {
      newErrors.minAge = 'Minimum age must be at least 18';
    }
    
    if (formData.maxAge > 99) {
      newErrors.maxAge = 'Maximum age must be less than 100';
    }
    
    if (formData.minAge >= formData.maxAge) {
      newErrors.ageRange = 'Maximum age must be greater than minimum age';
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

  const handleInputChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field] || errors.ageRange) {
      setErrors({ ...errors, [field]: '', ageRange: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-pink-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-10 h-10 text-pink-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Find Your Match</h3>
        <p className="text-gray-400">Tell us what you're looking for in a cosmic partner</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          I'm looking for *
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'non-binary', label: 'Non-Binary' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleInputChange('lookingFor', option.value)}
              className={`p-3 rounded-xl border transition-all ${
                formData.lookingFor === option.value
                  ? 'border-pink-400 bg-pink-500/20 text-pink-300'
                  : 'border-gray-600 bg-slate-800/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.lookingFor && (
          <p className="text-red-400 text-sm mt-1">{errors.lookingFor}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Age Range
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Minimum Age</label>
            <input
              type="number"
              min="18"
              max="99"
              value={formData.minAge}
              onChange={(e) => handleInputChange('minAge', parseInt(e.target.value))}
              className={`input-cosmic w-full ${errors.minAge || errors.ageRange ? 'border-red-500' : ''}`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Maximum Age</label>
            <input
              type="number"
              min="18"
              max="99"
              value={formData.maxAge}
              onChange={(e) => handleInputChange('maxAge', parseInt(e.target.value))}
              className={`input-cosmic w-full ${errors.maxAge || errors.ageRange ? 'border-red-500' : ''}`}
            />
          </div>
        </div>
        {(errors.minAge || errors.maxAge || errors.ageRange) && (
          <p className="text-red-400 text-sm mt-1">
            {errors.minAge || errors.maxAge || errors.ageRange}
          </p>
        )}
        <div className="mt-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-blue-300 text-sm">
            Looking for ages {formData.minAge} - {formData.maxAge}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-4">
        <h4 className="text-purple-300 font-medium mb-2">🌟 Cosmic Matching</h4>
        <p className="text-gray-400 text-sm">
          Our algorithm will analyze astrological compatibility including sun signs, 
          moon phases, planetary alignments, and more to find your perfect cosmic match!
        </p>
      </div>

      <button
        type="submit"
        className="btn-cosmic w-full mt-8"
      >
        Complete Your Profile
      </button>
    </form>
  );
};

export default PreferencesForm;
