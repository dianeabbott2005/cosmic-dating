import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto pt-8 pb-16">
        <button 
          onClick={() => navigate(-1)} // Go back to the previous page
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="card-cosmic p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Terms of Service for Cosmic Dating</h1>
          <p className="text-gray-400 mb-4">
            Last Updated: June 16, 2025
          </p>

          <p className="text-gray-300 mb-6">
            Welcome to Cosmic Dating! These Terms of Service ("Terms") govern your use of our mobile application and services. By accessing or using our services, you agree to be bound by these Terms.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-300 mb-6">
            By creating an account and using Cosmic Dating, you confirm that you are at least 18 years old and agree to these Terms. If you do not agree to these Terms, you may not use our services.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">2. Your Account</h2>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>You are responsible for maintaining the confidentiality of your account login information.</li>
            <li>You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.</li>
            <li>You are solely responsible for all activities that occur under your account.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">3. User Conduct</h2>
          <p className="text-gray-300 mb-4">
            You agree not to:
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>Use the service for any illegal or unauthorized purpose.</li>
            <li>Harass, abuse, or harm another person.</li>
            <li>Impersonate any person or entity.</li>
            <li>Interfere with or disrupt the service or servers or networks connected to the service.</li>
            <li>Attempt to bypass any measures of the service designed to prevent or restrict access to the service.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">4. Content</h2>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>You are solely responsible for the content you post or transmit through the service.</li>
            <li>You grant Cosmic Dating a worldwide, non-exclusive, royalty-free license to use, reproduce, adapt, publish, and distribute content you post on or through the service.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">5. Intellectual Property</h2>
          <p className="text-gray-300 mb-6">
            All intellectual property rights in the service and its content (excluding user-provided content) are owned by Cosmic Dating or its licensors.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">6. Disclaimers</h2>
          <p className="text-gray-300 mb-6">
            The service is provided "as is" and "as available" without any warranties of any kind, either express or implied. Cosmic Dating does not guarantee the accuracy or reliability of any astrological compatibility calculations or matches.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">7. Limitation of Liability</h2>
          <p className="text-gray-300 mb-6">
            To the fullest extent permitted by applicable law, Cosmic Dating shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the service; (b) any conduct or content of any third party on the service.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">8. Changes to Terms</h2>
          <p className="text-gray-300 mb-6">
            We reserve the right to modify these Terms at any time. We will notify you of any changes by posting the new Terms on this page. Your continued use of the service after any such changes constitutes your acceptance of the new Terms.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">9. Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions about these Terms, please contact us at:
            <br />
            support@cosmic-dating.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;