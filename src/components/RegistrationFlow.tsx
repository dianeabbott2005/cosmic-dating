
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PersonalInfoForm from '@/components/PersonalInfoForm';
import BirthInfoForm from '@/components/BirthInfoForm';
import PreferencesForm from '@/components/PreferencesForm';
import ProfileComplete from '@/components/ProfileComplete';

interface RegistrationFlowProps {
  onComplete: (userData: any) => void;
  onBack: () => void;
}

const RegistrationFlow = ({ onComplete, onBack }: RegistrationFlowProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [userData, setUserData] = useState({});

  const steps = [
    { title: 'Personal Info', component: PersonalInfoForm },
    { title: 'Birth Details', component: BirthInfoForm },
    { title: 'Preferences', component: PreferencesForm },
    { title: 'Complete', component: ProfileComplete }
  ];

  const handleStepComplete = (stepData: any) => {
    const updatedUserData = { ...userData, ...stepData };
    setUserData(updatedUserData);

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(updatedUserData);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={handlePrevStep}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              {steps[currentStep - 1].title}
            </h2>
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-12 h-1 rounded-full transition-colors ${
                    index + 1 <= currentStep ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <div className="text-sm text-gray-400">
            {currentStep}/{steps.length}
          </div>
        </div>

        {/* Step Content */}
        <div className="card-cosmic">
          <CurrentStepComponent 
            onNext={handleStepComplete}
            userData={userData}
          />
        </div>
      </div>
    </div>
  );
};

export default RegistrationFlow;
