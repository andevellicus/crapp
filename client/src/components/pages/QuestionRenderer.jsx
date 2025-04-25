// src/components/pages/QuestionRenderer.jsx
import React from 'react';

// Import cognitive test components
import CPTest from '../cognitive/CPTest';
import TMTest from '../cognitive/TMTest'; 
import DigitSpanTest from '../cognitive/DigitSpanTest';

// Helper function to parse settings (extracted from original Form.jsx logic)
const parseTestSettings = (question, defaultSettings) => {
    let settings = { ...defaultSettings };
    if (question && question.options && Array.isArray(question.options)) {
        question.options.forEach(option => {
            if (option.label && option.value !== undefined) {
                let value = option.value;
                // Attempt to convert to number or boolean if applicable
                if (typeof value === 'string') {
                    if (!isNaN(value) && !isNaN(parseFloat(value))) {
                        value = parseFloat(value);
                    } else if (value.toLowerCase() === 'true') {
                        value = true;
                    } else if (value.toLowerCase() === 'false') {
                        value = false;
                    // Specific handling for CPT targets/nonTargets if needed
                    } else if ((option.label === 'targets' || option.label === 'nonTargets') && typeof value === 'string' && value.includes(',')) {
                         value = value.split(',').map(item => item.trim());
                    } else if (option.label === 'targets' && typeof value === 'string' && !value.includes(',')) {
                         value = [value]; // Ensure targets is an array
                    }
                }
                settings[option.label] = value;
            }
        });
    }
    return settings;
};


const QuestionRenderer = ({
    question,
    answer,
    onChange,
    // Props for cognitive tests
    setTmtResults,
    setCptResults,
    setDigitSpanResults,
    setIsDoingCognitiveTest
}) => {

    if (!question) {
        return null; // Or a loading indicator
    }

    // --- Render functions for specific types (moved from Form.jsx) ---

    const renderRadioQuestion = () => (
        <div className="symptom-scale"> 
            {question.options.map(option => (
                <label key={option.value} className="option-label"> 
                    <input
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={answer === option.value}
                        onChange={() => onChange(question.id, option.value)} 
                        required={question.required}
                    />
                    <div className="option-text"> 
                        <strong>{option.label}</strong>
                        {option.description && <div>{option.description}</div>}
                    </div>
                </label>
            ))}
        </div>
    );

    const renderDropdownQuestion = () => (
        <select
            name={question.id}
            value={answer || ''}
            onChange={(e) => onChange(question.id, e.target.value)}
            required={question.required}
        >
            {/* Add a default 'select' option if needed and not required */}
            { !question.required && <option value="">-- Select --</option> }
            {question.options.map(option => ( //
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );

    const renderTextQuestion = () => ( 
        <textarea
            name={question.id}
            value={answer || ''} 
            onChange={(e) => onChange(question.id, e.target.value)} 
            placeholder={question.placeholder || ''} 
            maxLength={question.max_length} 
            required={question.required} 
        />
    );

     const renderCPTest = () => { 
        const defaultSettings = { /* Default CPT settings */ }; // Define or import defaults
        const testSettings = parseTestSettings(question, defaultSettings); 

        return (
            <CPTest
                settings={testSettings} 
                questionId={question.id} 
                onTestEnd={(results) => { 
                    setCptResults(results); 
                    setIsDoingCognitiveTest(false); 
                    onChange(question.id, true);
                }}
                onTestStart={() => { 
                    setIsDoingCognitiveTest(true); 
                    onChange(question.id, undefined);
                }}
            />
        );
    };

    const renderTrailTest = () => { 
         const defaultSettings = { /* Default TMT settings */ }; // Define or import defaults
        const testSettings = parseTestSettings(question, defaultSettings); 

        return (
            <TMTest
                settings={testSettings} 
                questionId={question.id} 
                onTestEnd={(results) => { 
                    setTmtResults(results); 
                    setIsDoingCognitiveTest(false); 
                    onChange(question.id, true);
                }}
                onTestStart={() => { 
                    setIsDoingCognitiveTest(true); 
                    onChange(question.id, undefined);
                }}
            />
        );
    };

    const renderDigitSpanTest = () => { 
         const defaultSettings = { /* Default Digit Span settings */ }; // Define or import defaults
        const testSettings = parseTestSettings(question, defaultSettings); //

        return (
            <DigitSpanTest
                settings={testSettings} 
                questionId={question.id} 
                onTestEnd={(results) => { 
                    setDigitSpanResults(results); 
                    setIsDoingCognitiveTest(false); 
                    onChange(question.id, true);
                }}
                onTestStart={() => { 
                    setIsDoingCognitiveTest(true); 
                    onChange(question.id, undefined);
                }}
            />
        );
    };


    // --- Main Render Logic ---
    let questionContent;
    switch (question.type) { 
        case 'radio':
            questionContent = renderRadioQuestion(); 
            break;
        case 'dropdown':
            questionContent = renderDropdownQuestion(); 
            break;
        case 'text':
            questionContent = renderTextQuestion(); 
            break;
        case 'cpt':
            questionContent = renderCPTest(); 
            break;
        case 'tmt':
            questionContent = renderTrailTest(); 
            break;
        case 'digit_span':
            questionContent = renderDigitSpanTest(); 
            break;
        default:
            questionContent = <p>Unsupported question type: {question.type}</p>; 
    }

    return (
        <div className="form-group" data-question-id={question.id}> 
            <h3>{question.title}</h3> 
            {question.description && <p>{question.description}</p>} 
            {questionContent}
            {/* Validation errors specific to this question could potentially be displayed here */}
        </div>
    );
};

export default QuestionRenderer;