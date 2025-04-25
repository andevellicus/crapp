// src/components/common/TermsModal.jsx
import React from 'react';
import Modal from './Modal';

const TermsModal = ({ isOpen, onClose }) => {
  // The accept button will act as the footer
  const footerContent = (
    <button className="submit-button" onClick={onClose}>I Accept</button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose} // Allow closing by clicking backdrop or X
      title="Terms and Conditions"
      footer={footerContent}
      modalClassName="terms-modal-content" // Apply specific styling class
    >
      {/* Pass the existing terms body content as children */}
      <div className="terms-body">
        <p className="last-updated">Last Updated: April 15, 2025</p> 

        <div className="terms-section">
          <h5>1. Acceptance of Terms</h5> 
          <p>
            Welcome to the Cognitive Reporting Application ("CRAPP"). By accessing or using our application,
            you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms,
            please do not use the application. 
          </p>
        </div>

        <div className="terms-section">
          <h5>2. Description of Service</h5> 
          <p>
            CRAPP is a daily symptom and cognition tracking application that allows users to record and monitor
            cognitive symptoms, complete cognitive tests, and track their health over time. 
          </p>
        </div>

        <div className="terms-section">
          <h5>3. User Accounts</h5> 
          <p>
            To use CRAPP, you must create an account. You are responsible for maintaining the confidentiality
            of your account information and for all activities that occur under your account. 
          </p>
        </div>

        <div className="terms-section">
          <h5>4. Privacy and Data Usage</h5> 
          <p>
            We collect and process personal information as described in our Privacy Policy. By using CRAPP,
            you consent to our collection, use, and sharing of your information as described in the Privacy Policy. 
          </p>
        </div>

        <div className="terms-section">
          <h5>5. User Conduct</h5> 
          <p>
            You agree not to use the application for any unlawful purpose, interfere with the application,
            attempt to gain unauthorized access, create multiple accounts for abusive purposes,
            impersonate others, or share your account credentials. 
          </p>
        </div>

        <div className="terms-section">
          <h5>6. Intellectual Property</h5> 
          <p>
            All content and materials available in CRAPP are the property of CRAPP or its
            licensors and are protected by copyright, trademark, and other intellectual property laws. 
          </p>
        </div>

        <div className="terms-section">
          <h5>7. Medical Disclaimer</h5> 
          <p>
            CRAPP is not intended to provide medical advice, diagnosis, or treatment. The content and
            services provided are for informational purposes only. 
          </p>
        </div>

        <div className="terms-section">
          <h5>8. Limitation of Liability</h5> 
          <p>
            To the maximum extent permitted by law, CRAPP will not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising out of or relating to your use of the application. 
          </p>
        </div>

        <div className="terms-section">
          <h5>9. Termination</h5> 
          <p>
            We reserve the right to terminate or suspend your account and access to CRAPP at our sole
            discretion, without notice, for conduct that we believe violates these Terms. 
          </p>
        </div>

        <div className="terms-section">
          <h5>10. Changes to Terms</h5> 
          <p>
            We may modify these Terms at any time. We will notify you of any changes by posting the new
            Terms on the application and updating the "Last Updated" date. 
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default TermsModal;