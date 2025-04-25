// client/src/components/cognitive/DigitSpanTest.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatTime } from '../../utils/utils';

// Default settings (can be overridden by props later if needed)
const DEFAULT_SETTINGS = {
  initialSpan: 3,       // Starting number of digits
  maxSpan: 10,          // Maximum number of digits
  displayTimePerDigit: 1000, // Time each digit is shown (ms)
  interDigitInterval: 500,  // Time between digits (ms)
  recallTimeout: 10000,    // Time limit for recall (ms) - 10 seconds
  trialsPerSpan: 2,       // Number of attempts at each span length
};

export default function DigitSpanTest({ onTestEnd, onTestStart, settings, questionId }) {
  const testSettings = { ...DEFAULT_SETTINGS, ...settings };

  const [phase, setPhase] = useState('instructions'); // instructions, presenting, recalling, results
  const [currentSpan, setCurrentSpan] = useState(testSettings.initialSpan);
  const [currentSequence, setCurrentSequence] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [trial, setTrial] = useState(1); // Current trial for the current span
  const [attemptsData, setAttemptsData] = useState([]); // Store results per trial
  const [feedback, setFeedback] = useState(''); // Feedback message like 'Correct', 'Incorrect'
  const [displayIndex, setDisplayIndex] = useState(0); // For showing digits one by one
  const [remainingTime, setRemainingTime] = useState(testSettings.recallTimeout);
  const [showDigit, setShowDigit] = useState(false); // Control visibility of digit

  const timerRef = useRef(null);
  const countdownRef = useRef(null); // For recall countdown timer
  const inputRef = useRef(null); // Ref for the input field
  const testDataRef = useRef({ // For collecting raw data
    testStartTime: 0,
    testEndTime: 0,
    results: [], // Will store { span, trial, sequence, input, correct }
    settings: testSettings,
  });

  // --- Helper Functions ---

  // Generate a sequence of random digits (1-9)
  const generateSequence = (length) => {
    const sequence = [];
    for (let i = 0; i < length; i++) {
      sequence.push(Math.floor(Math.random() * 9) + 1); // Digits 1-9
    }
    return sequence;
  };

// Modify startTrial to accept the length argument
const startTrial = useCallback((spanLength) => { 
  setUserInput('');
  setFeedback('');
  // Generate sequence using the passed argument
  const sequence = generateSequence(spanLength);
  setCurrentSequence(sequence);
  setPhase('presenting'); 
  setDisplayIndex(0);
  setShowDigit(false);
  testDataRef.current.testStartTime = testDataRef.current.testStartTime || performance.now();
  setTimeout(() => {
      setShowDigit(true);
  }, 500);
}, [questionId]);

  // --- Effects ---

  // Effect to handle the presentation phase (showing digits one by one)
  useEffect(() => {
    if (phase === 'presenting') {
      if (displayIndex < currentSequence.length) {
        if (showDigit) {
          // Currently showing a digit, schedule hiding it
          timerRef.current = setTimeout(() => {
            setShowDigit(false);
            
            // Schedule next action
            setTimeout(() => {
              if (displayIndex < currentSequence.length - 1) {
                // Move to next digit
                setDisplayIndex(prevIndex => prevIndex + 1);
                setShowDigit(true);
              } else {
                // All digits shown, move to recall phase
                setPhase('recalling');
                setRemainingTime(testSettings.recallTimeout);
              }
            }, testSettings.interDigitInterval);
            
          }, testSettings.displayTimePerDigit);
        }
      }

      return () => {
        clearTimeout(timerRef.current);
      }; // Cleanup timer
    }
  }, [phase, displayIndex, showDigit, currentSequence.length, testSettings.displayTimePerDigit, testSettings.interDigitInterval]);

  // Effect to focus input and start recall timer when moving to 'recalling' phase
  useEffect(() => {
    if (phase === 'recalling') {
      // Focus the input field
      if (inputRef.current) {
        inputRef.current.focus();
      }

      // Setup countdown timer that updates every second
      setRemainingTime(testSettings.recallTimeout);
      
      // Start countdown timer
      countdownRef.current = setInterval(() => {
        setRemainingTime(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            // Time's up, check the answer automatically
            clearInterval(countdownRef.current);
            handleRecallSubmit();
            return 0;
          }
          return newTime;
        });
      }, 1000);
      
      // Also setup the main timeout
      timerRef.current = setTimeout(() => {
        // Time's up, check the answer automatically
        handleRecallSubmit();
      }, testSettings.recallTimeout);

      return () => {
        clearTimeout(timerRef.current);
        clearInterval(countdownRef.current);
      }; // Cleanup timers
    }
  }, [phase, testSettings.recallTimeout]);


  // --- Event Handlers ---

  const handleStartTest = () => {
    if (onTestStart) onTestStart();
    startTrial(currentSpan);
  };

  const handleInputChange = (event) => {
    // Allow only digits
    const value = event.target.value.replace(/[^0-9]/g, '');
    setUserInput(value);
  };

  // Handle submission of the recalled sequence
  const handleRecallSubmit = () => {
    clearTimeout(timerRef.current); // Stop the recall timer
    clearInterval(countdownRef.current); // Stop countdown
    
    if (phase !== 'recalling') return; // Avoid multiple submissions

    const correct = userInput === currentSequence.join('');
    const result = {
      span: currentSpan,
      trial: trial,
      sequence: currentSequence.join(''),
      input: userInput,
      correct: correct,
      timestamp: performance.now() - testDataRef.current.testStartTime,
    };

    const updatedAttempts = [...attemptsData, result];
    setAttemptsData(updatedAttempts);
    testDataRef.current.results = updatedAttempts; // Update raw data ref

    setFeedback(correct ? 'Correct!' : 'Incorrect');

    // Logic to move to the next trial/span or end the test
    setTimeout(() => {
      if (correct) {
        // Correct answer, move to next span length
        const nextSpan = currentSpan + 1;
        if (nextSpan > testSettings.maxSpan) {
          endTest(updatedAttempts); // Reached max span
        } else {
          startTrial(nextSpan); // Start next span level
          setCurrentSpan(nextSpan);
          setTrial(1); // Reset trial count for new span
        }
      } else {
        // Incorrect answer
        if (trial < testSettings.trialsPerSpan) {
          // Allow another trial at the same span length
          startTrial(currentSpan);
          setTrial(prevTrial => prevTrial + 1);
        } else {
          // Failed all trials for this span, end the test
          endTest(updatedAttempts);
        }
      }
    }, 1500); // Short delay to show feedback
  };

  // Handle Enter key press in input field
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && phase === 'recalling') {
      event.preventDefault(); // Prevent default form submission
      handleRecallSubmit();
    }
  };


  // End the test and call the callback
  const endTest = (finalAttempts) => {
    setPhase('results');
    testDataRef.current.testEndTime = performance.now();
    testDataRef.current.results = finalAttempts; // Ensure final results are in ref
    if (onTestEnd) {
      onTestEnd(testDataRef.current);
    }
  };

  // --- Render Functions ---

  const renderInstructions = () => (
    <div className="digit-span-intro">
      <h3>Digit Span Test</h3>
      <div className="digit-span-instructions">
        <p>This test measures your short-term memory capacity.</p>
        <p><strong>Instructions:</strong></p>
        <ul>
          <li>You will see a sequence of digits displayed one at a time.</li>
          <li>Pay close attention and try to remember the sequence.</li>
          <li>After the sequence is shown, you will be asked to type the digits in the exact order they appeared.</li>
          <li>The length of the sequence will increase if you answer correctly.</li>
        </ul>
        <p>Click 'Start Test' when you are ready.</p>
      </div>
      <button className="submit-button" onClick={handleStartTest}>
        Start Test
      </button>
    </div>
  );

  const renderPresenting = () => (
    <div className="digit-span-test-container">
      <div className="digit-span-header">
        <div className="digit-span-info">
          <span>Current span length: {currentSpan}</span>
          <span>Trial: {trial} of {testSettings.trialsPerSpan}</span>
        </div>
      </div>
      
      <div className="digit-stimulus-container">
        <div className="digit-stimulus">
          {/* Display the current digit or empty string */}
          {(showDigit && displayIndex < currentSequence.length) ? currentSequence[displayIndex] : ''}
        </div>
      </div>
      
      <div className="digit-span-instructions-small">
        <p>Memorize each digit as it appears</p>
      </div>
    </div>
  );

  const renderRecalling = () => (
    <div className="digit-span-test-container">
      <div className="digit-span-header">
        <div className="digit-span-timer">
          Time Remaining: <span id="recall-time-remaining">
            {formatTime(remainingTime)}
          </span>
        </div>
      </div>
      
      <div className="digit-span-recall-area">
        <p className="digit-span-info">Enter the sequence you saw:</p>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="digit-input"
          maxLength={currentSpan + 2}
          autoComplete="off"
          placeholder="Type the digits here"
        />
        
        <button
          type="button"
          className="submit-button recall-submit-button"
          onClick={handleRecallSubmit}
        >
          Submit
        </button>
      </div>
      
      {/* Display feedback */}
      {feedback && <p className={`feedback ${feedback === 'Correct!' ? 'correct' : 'incorrect'}`}>{feedback}</p>}
      
      <div className="digit-span-instructions-small">
        <p>Type the digits in the exact order they appeared</p>
      </div>
    </div>
  );

  const renderResults = () => {
    // Determine the highest span achieved correctly
    let highestSpan = 0;
    if (attemptsData && attemptsData.length > 0) {
        const correctAttempts = attemptsData.filter(a => a.correct);
        if (correctAttempts.length > 0) {
            highestSpan = Math.max(...correctAttempts.map(a => a.span));
        } 
    }

    return (
      <div className="digit-span-completion-message">
        <h3>Test Completed</h3>
        <p>Your maximum digit span achieved: <strong>{highestSpan}</strong></p>
        <p>Your results have been saved.</p>
        <p>You can now proceed to the next question.</p>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="cognitive-test-container digit-span-container">
      {phase === 'instructions' && renderInstructions()}
      {phase === 'presenting' && renderPresenting()}
      {phase === 'recalling' && renderRecalling()}
      {phase === 'results' && renderResults()}
    </div>
  );
}