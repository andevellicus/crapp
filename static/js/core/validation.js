// static/js/core/validation.js
window.CRAPP = window.CRAPP || {};

CRAPP.validation = (function() {
    // Validation rules with regex patterns and error messages
    const VALIDATION_RULES = {
        required: {
            test: value => value !== undefined && value !== null && value.toString().trim() !== '',
            message: 'This field is required'
        },
        email: {
            test: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: 'Please enter a valid email address'
        },
        password: {
            test: value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value),
            message: 'Password must be at least 8 characters and include uppercase, lowercase, and numbers'
        },
        minLength: {
            test: (value, length) => value.length >= length,
            message: (length) => `Must be at least ${length} characters`
        },
        maxLength: {
            test: (value, length) => value.length <= length,
            message: (length) => `Must be no more than ${length} characters`
        },
        match: {
            test: (value, field, formValues) => value === formValues[field],
            message: (field) => `Must match ${field.replace('_', ' ')}`
        },
        pattern: {
            test: (value, pattern) => new RegExp(pattern).test(value),
            message: 'Please enter a valid value'
        },
        number: {
            test: value => !isNaN(parseFloat(value)) && isFinite(value),
            message: 'Please enter a valid number'
        },
        integer: {
            test: value => Number.isInteger(Number(value)),
            message: 'Please enter a whole number'
        },
        min: {
            test: (value, min) => Number(value) >= min,
            message: (min) => `Must be at least ${min}`
        },
        max: {
            test: (value, max) => Number(value) <= max,
            message: (max) => `Must be no more than ${max}`
        },
        checked: {
            test: value => value === true,
            message: 'This checkbox must be checked'
        }
    };
    
    // Private methods
    function getFormValues(form) {
        const formData = new FormData(form);
        const values = {};
        
        for (const [key, value] of formData.entries()) {
            values[key] = value;
        }
        
        // Handle checkboxes that aren't checked (not included in FormData)
        Array.from(form.querySelectorAll('input[type="checkbox"]')).forEach(checkbox => {
            if (!formData.has(checkbox.name)) {
                values[checkbox.name] = false;
            } else {
                values[checkbox.name] = true;
            }
        });
        
        return values;
    }
    
    function showFieldError(field, message) {
        // Remove any existing error message
        removeFieldError(field);
        
        // Add error class to field
        field.classList.add('error-field');
        
        // Create error message element
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        errorElement.style.color = '#e53e3e';
        errorElement.style.fontSize = '0.8rem';
        errorElement.style.marginTop = '5px';
        
        // Insert after field
        if (field.parentNode) {
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }
    }
    
    function removeFieldError(field) {
        // Remove error class
        field.classList.remove('error-field');
        
        // Remove any existing error message
        if (field.parentNode) {
            const existingError = field.parentNode.querySelector('.validation-error');
            if (existingError) {
                existingError.remove();
            }
        }
    }
    
    function clearFormErrors(form) {
        // Remove all error messages
        form.querySelectorAll('.validation-error').forEach(error => error.remove());
        
        // Remove error class from all fields
        form.querySelectorAll('.error-field').forEach(field => {
            field.classList.remove('error-field');
        });
    }
    
    // Public interface
    return {
        // Validate a single field
        validateField: function(field, rules, formValues = {}) {
            const value = field.type === 'checkbox' ? field.checked : field.value;
            let isValid = true;
            let errorMessage = '';
            
            // Apply each rule
            for (const [ruleName, ruleParams] of Object.entries(rules)) {
                // Skip if rule doesn't exist
                if (!VALIDATION_RULES[ruleName]) continue;
                
                const rule = VALIDATION_RULES[ruleName];
                let params = ruleParams;
                
                // Handle rule with parameters
                let isRuleValid;
                if (typeof ruleParams === 'object' && ruleParams !== null) {
                    params = ruleParams.value;
                    isRuleValid = rule.test(value, params, formValues);
                } else {
                    isRuleValid = rule.test(value, params, formValues);
                }
                
                if (!isRuleValid) {
                    isValid = false;
                    // Use custom message if provided
                    if (typeof ruleParams === 'object' && ruleParams.message) {
                        errorMessage = ruleParams.message;
                    } else if (typeof rule.message === 'function') {
                        errorMessage = rule.message(params);
                    } else {
                        errorMessage = rule.message;
                    }
                    break;
                }
            }
            
            // Show or clear error message
            if (!isValid) {
                showFieldError(field, errorMessage);
            } else {
                removeFieldError(field);
            }
            
            return isValid;
        },
        
        // Validate an entire form
        validateForm: function(form, validationRules) {
            clearFormErrors(form);
            
            const formValues = getFormValues(form);
            let isValid = true;
            
            // Validate each field with rules
            Object.entries(validationRules).forEach(([fieldName, rules]) => {
                const field = form.querySelector(`[name="${fieldName}"]`);
                if (!field) return;
                
                if (!this.validateField(field, rules, formValues)) {
                    isValid = false;
                }
            });
            
            return isValid;
        },
        
        // Convert API validation errors to form errors
        showAPIErrors: function(form, errors) {
            clearFormErrors(form);
            
            // Handle array of errors
            if (Array.isArray(errors)) {
                errors.forEach(error => {
                    const field = form.querySelector(`[name="${error.field}"]`);
                    if (field) {
                        showFieldError(field, error.message);
                    }
                });
            } 
            // Handle object with field keys
            else if (typeof errors === 'object' && errors !== null) {
                Object.entries(errors).forEach(([fieldName, message]) => {
                    const field = form.querySelector(`[name="${fieldName}"]`);
                    if (field) {
                        showFieldError(field, message);
                    }
                });
            }
        },
        
        // Clear all errors on a form
        clearErrors: clearFormErrors,
        
        // Get all form values as an object
        getFormValues: getFormValues,
        
        // Add a custom validation rule
        addRule: function(name, testFn, errorMessage) {
            VALIDATION_RULES[name] = {
                test: testFn,
                message: errorMessage
            };
        }
    };
})();