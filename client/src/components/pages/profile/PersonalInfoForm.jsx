// src/components/pages/profile/PersonalInfoForm.jsx
import React from 'react';

const PersonalInfoForm = ({ formData, handleInputChange }) => {
    return (
        <>
            <div className="form-row"> 
                <div className="form-group"> 
                    <label htmlFor="first_name">First Name</label> 
                    <input
                        type="text"
                        id="first_name"
                        name="first_name"
                        value={formData.first_name} //
                        onChange={handleInputChange} //
                        required //
                    /> 
                </div> 
                <div className="form-group"> 
                    <label htmlFor="last_name">Last Name</label> 
                    <input
                        type="text"
                        id="last_name"
                        name="last_name"
                        value={formData.last_name} //
                        onChange={handleInputChange} //
                        required //
                    /> 
                </div> 
            </div> 
            <div className="form-group"> 
                <label htmlFor="email">Email Address</label> 
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email} //
                    readOnly //
                    className="readonly-field" //
                /> 
                <div className="field-note">Email address cannot be changed</div> 
            </div> 
        </>
    );
};

export default PersonalInfoForm;