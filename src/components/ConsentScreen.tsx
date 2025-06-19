import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ConsentScreenProps {
  onAgree: () => void;
}

const ConsentScreen = ({ onAgree }: ConsentScreenProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAgreeAndContinue = async () => {
    if (!agreed) {
      toast({
        title: "Consent Required",
        description: "Please agree to the Privacy Policy and Terms of Service to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "User not logged in. Please try logging in again.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      console.log('ConsentScreen: Attempting to update profile consent for user ID:', user.id);
      const { error } = await supabase
        .from('profiles')
        .update({ has_agreed_to_terms: true })
        .eq('user_id', user.id);

      if (error) {
        console.error('ConsentScreen: Supabase update error for consent:', error.message);
        throw error;
      } else {
        console.log('ConsentScreen: Successfully updated profile consent for user ID:', user.id);
      }

      toast({
        title: "Consent Recorded",
        description: "Thank you for agreeing to our terms.",
      });
      onAgree(); // This calls checkUserProfile in Index.tsx
    } catch (error: any) {
      console.error('ConsentScreen: Failed to record consent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to record consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisagree = () => {
    toast({
      title: "Action Required",
      description: "You must agree to the Privacy Policy and Terms of Service to use the application. Redirecting to home.",
      variant: "destructive",
    });
    // Immediately navigate to home
    navigate('/'); 
  };

  return (
    <div className="min-h-screen cosmic-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full card-cosmic p-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Your Privacy Matters</h1>
        <p className="text-gray-400 mb-8">
          Before we begin, please review and agree to our Privacy Policy and Terms of Service.
        </p>

        <div className="flex items-center space-x-2 mb-8 justify-center">
          <Checkbox 
            id="terms" 
            checked={agreed} 
            onCheckedChange={(checked) => setAgreed(checked === true)} 
            className="border-purple-500 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
          />
          <Label htmlFor="terms" className="text-gray-300 text-base">
            I agree to the{' '}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
              Terms of Service
            </a>
            .
          </Label>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleAgreeAndContinue}
            disabled={loading}
            className="btn-cosmic w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Agree and Continue'
            )}
          </button>
          <button
            onClick={handleDisagree}
            className="w-full px-6 py-3 border border-red-500 text-red-400 rounded-xl hover:bg-red-500/10 transition-all"
          >
            Disagree
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentScreen;