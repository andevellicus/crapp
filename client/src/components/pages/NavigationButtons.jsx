// src/components/pages/NavigationButtons.jsx
import React from 'react';

const NavigationButtons = ({ currentStep, totalSteps, onPrev, onNext, disabled }) => {
    return (
        <div className="navigation-buttons" id="nav-buttons"> 
            {currentStep > 1 && ( //
                <button
                    type="button"
                    className="nav-button prev-button" //
                    onClick={onPrev} //
                    disabled={disabled} // Disable if loading/submitting
                >
                    Previous 
                </button>
            )}

            <button
                type="button"
                className="nav-button next-button" //
                onClick={onNext} //
                disabled={disabled} // Disable if loading/submitting
                // Conditionally change text if it's the last step before submission?
                // style={{ marginLeft: currentStep <= 1 ? 'auto' : undefined }} // Push next button right if no prev
            >
                {currentStep === totalSteps ? 'Finish' : 'Next'} {/* Change text on last step */} 
            </button>
        </div>
    );
};

export default NavigationButtons;