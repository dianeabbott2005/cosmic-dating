import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
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
          <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy for Cosmic Dating</h1>
          <p className="text-gray-400 mb-4">
            Last Updated: July 26, 2024
          </p>

          <p className="text-gray-300 mb-6">
            Welcome to Cosmic Dating! We are committed to protecting your privacy and ensuring a safe and enjoyable experience. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our mobile application and services.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
          <p className="text-gray-300 mb-4">
            We collect information to provide and improve our services. This includes:
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>
              <strong>Personal Information:</strong> When you create an account, we collect your first name, last name, email address, gender, and preferences (who you are looking for, age range).
            </li>
            <li>
              <strong>Astrological Data:</strong> To provide our unique astrological matching service, we collect your date of birth, time of birth, and place of birth (city, latitude, longitude, and timezone). This data is crucial for generating your natal chart and compatibility scores.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect information about how you access and use our services, such as your interactions with matches, chat messages, and features used.
            </li>
            <li>
              <strong>Device Information:</strong> We may collect information about the device you use to access our services, including IP address, device type, operating system, and unique device identifiers.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
          <p className="text-gray-300 mb-4">
            Your information is used to:
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>Provide and maintain our service, including creating your profile and enabling astrological matching.</li>
            <li>Facilitate communication between you and your matches through our chat feature.</li>
            <li>Improve, personalize, and expand our services.</li>
            <li>Understand and analyze how you use our services.</li>
            <li>Detect, prevent, and address technical issues and fraudulent activity.</li>
            <li>Communicate with you, including sending updates, security alerts, and support messages.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">3. Sharing Your Information</h2>
          <p className="text-gray-300 mb-4">
            We may share your information in the following situations:
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>
              <strong>With Matches:</strong> Your first name, age, sun sign, and place of birth may be visible to your matches to facilitate connections. Your exact birth time and full birth date are used for calculations but are not directly displayed to other users.
            </li>
            <li>
              <strong>Service Providers:</strong> We may share your information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf, such as payment processing, data analysis, email delivery, hosting services, and customer service.
              <ul>
                <li>Supabase (for database, authentication, and serverless functions)</li>
                <li>Google Maps API (for place search and timezone determination)</li>
                <li>Gemini API (for AI-driven chat responses with automated profiles)</li>
              </ul>
            </li>
            <li>
              <strong>Legal Obligations:</strong> We may disclose your information where required to do so by law or in response to valid requests by public authorities.
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-white mb-4">4. Data Security</h2>
          <p className="text-gray-300 mb-6">
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">5. Your Privacy Rights</h2>
          <p className="text-gray-300 mb-4">
            Depending on your location, you may have the following rights regarding your personal information:
          </p>
          <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
            <li>The right to access, update, or delete the information we have on you.</li>
            <li>The right to object to our processing of your information.</li>
            <li>The right to request that we restrict the processing of your personal information.</li>
            <li>The right to data portability.</li>
            <li>The right to withdraw consent at any time where Cosmic Dating relied on your consent to process your personal information.</li>
          </ul>
          <p className="text-gray-300 mb-6">
            To exercise any of these rights, please contact us at [Your Contact Email Here].
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">6. Children's Privacy</h2>
          <p className="text-gray-300 mb-6">
            Our service is not intended for individuals under the age of 18. We do not knowingly collect personally identifiable information from anyone under the age of 18. If you are a parent or guardian and you are aware that your child has provided us with personal data, please contact us.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">7. Changes to This Privacy Policy</h2>
          <p className="text-gray-300 mb-6">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <h2 className="text-2xl font-semibold text-white mb-4">8. Contact Us</h2>
          <p className="text-gray-300">
            If you have any questions about this Privacy Policy, please contact us at:
            <br />
            support@cosmic-dating.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;