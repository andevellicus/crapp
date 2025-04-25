// src/components/pages/profile/PasswordForm.jsx
import React from 'react';

const PasswordForm = ({ formData, handleInputChange }) => {
    return (
        <>
            <div className="form-group"> 
                <label htmlFor="current_password">Current Password</label> 
                <input
                    type="password"
                    id="current_password"
                    name="current_password"
                    value={formData.current_password} //
                    onChange={handleInputChange} //
                    autoComplete="current-password"
                /> 
            </div> 
            <div className="form-group"> 
                <label htmlFor="new_password">New Password</label> 
                <input
                    type="password"
                    id="new_password"
                    name="new_password"
                    value={formData.new_password} //
                    onChange={handleInputChange} //
                    minLength="8" //
                    pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}" //
                    autoComplete="new-password"
                /> 
                 <div className="password-requirements"> 
                    Passwords must be at least 8 characters long and include uppercase letters, 
                    lowercase letters, and numbers. 
                </div> 
            </div> 
            <div className="form-group"> 
                <label htmlFor="confirm_password">Confirm New Password</label> 
                <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password} //
                    onChange={handleInputChange} //
                     autoComplete="new-password"
                /> 
            </div> 
             <div className="field-note">Leave password fields empty if you don't want to change your password</div> 
        </>
    );
};

export default PasswordForm;