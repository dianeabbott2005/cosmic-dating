
import { useState } from 'react';
import { User, Eye, EyeOff } from 'lucide-react';

interface PersonalInfoFormProps {
  onNext: (data: any) => void;
  userData: any;
}

const PersonalInfoForm = ({ onNext, userData }: PersonalInfoFormProps) => {
  const [formData, setFormData] = useState({
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    email: userData.email || '',
    password: userData.password || '',
    gender: userData.gender || '',
    ...userData
  });

  const [errors, setErrors] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.gender) {
      newErrors.gender = 'Please select your gender';
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
        <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-purple-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Tell us about yourself</h3>
        <p className="text-gray-400">Let's start with the basics</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          First Name *
        </label>
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => handleInputChange('firstName', e.target.value)}
          className={`input-cosmic w-full ${errors.firstName ? 'border-red-500' : ''}`}
          placeholder="Enter your first name"
        />
        {errors.firstName && (
          <p className="text-red-400 text-sm mt-1">{errors.firstName}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Last Name *
        </label>
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => handleInputChange('lastName', e.target.value)}
          className={`input-cosmic w-full ${errors.lastName ? 'border-red-500' : ''}`}
          placeholder="Enter your last name"
        />
        {errors.lastName && (
          <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className={`input-cosmic w-full ${errors.email ? 'border-red-500' : ''}`}
          placeholder="Enter your email address"
        />
        {errors.email && (
          <p className="text-red-400 text-sm mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Password *
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className={`input-cosmic w-full pr-12 ${errors.password ? 'border-red-500' : ''}`}
            placeholder="Create a password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-400 text-sm mt-1">{errors.password}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Gender *
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
              onClick={() => handleInputChange('gender', option.value)}
              className={`p-3 rounded-xl border transition-all ${
                formData.gender === option.value
                  ? 'border-purple-400 bg-purple-500/20 text-purple-300'
                  : 'border-gray-600 bg-slate-800/50 text-gray-300 hover:border-gray-500'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.gender && (
          <p className="text-red-400 text-sm mt-1">{errors.gender}</p>
        )}
      </div>

      <button
        type="submit"
        className="btn-cosmic w-full mt-8"
      >
        Continue to Birth Details
      </button>
    </form>
  );
};

export default PersonalInfoForm;
