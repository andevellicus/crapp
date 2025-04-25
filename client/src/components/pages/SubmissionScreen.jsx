// src/components/pages/SubmissionScreen.jsx
import React from 'react';

const SubmissionScreen = ({ onSubmit, onBack, onReset, isSubmitting }) => {
    return (
        <div>
            <p className="completion-message"> 
                You have answered all the questions. Please review if needed, then submit your responses.
            </p>

            {/* Optionally add a summary of answers here if needed */}

            <div className="navigation-buttons"> 
                <button
                    type="button"
                    className="nav-button prev-button" 
                    onClick={onBack} 
                    disabled={isSubmitting} 
                >
                    Back to Questions 
                </button>

                <button
                    type="button"
                    className="submit-button" 
                    onClick={onSubmit} 
                    disabled={isSubmitting} 
                >
                    {isSubmitting ? 'Submitting...' : 'Submit'} 
                </button>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center' }}> {/* Wrapper div for centering */}
                <button
                    type="button"
                    className="reset-button" 
                    onClick={onReset} 
                    disabled={isSubmitting} 
                    style={{ width: 'auto', padding: '8px 15px', display:'inline-block' }} // Make reset button smaller
                >
                    Start Over 
                </button>
            </div>
        </div>
    );
};

export default SubmissionScreen;