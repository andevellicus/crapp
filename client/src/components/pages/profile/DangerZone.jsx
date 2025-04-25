// src/components/pages/profile/DangerZone.jsx
import React from 'react';

const DangerZone = ({ onDeleteClick, isSaving }) => {
    return (
        <>
             <p className="warning-text">This action cannot be undone. All your data will be permanently deleted.</p> 
            <button
                type="button"
                onClick={onDeleteClick} //
                className="danger-button" //
                disabled={isSaving} //
                style={{ width: 'auto', padding: '10px 20px'}} // Make button not full width
            >
                Delete My Account 
            </button> 
        </>
    );
};

export default DangerZone;