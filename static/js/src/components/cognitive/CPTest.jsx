// Updated CPTest.jsx component focused on data collection only
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../utils/utils';

export default function CPTest({ onTestEnd, onTestStart, settings, questionId  }) {
  // Default settings will be overridden by props
  const DEFAULT_SETTINGS = {
    testDuration: 120000, // 2 minutes in milliseconds
    stimulusDuration: 250, // Time stimulus is displayed (ms)
    interStimulusInterval: 2000, // Time between stimuli (ms)
    targetProbability: 0.7, // Probability of target stimulus
    targets: ['X'], // Target stimuli that require response
    nonTargets: ['A', 'B', 'C', 'E', 'F', 'H', 'K', 'L'], // Non-target stimuli to ignore
  };
  
  // Merge settings
  const testSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentStimulus, setCurrentStimulus] = useState(null);
  const [remainingTime, setRemainingTime] = useState(testSettings.testDuration);
  
  // Refs
  const timerIntervalRef = useRef(null);
  const stimulusTimeoutRef = useRef(null);
  const stimulusStartTimeRef = useRef(0);
  const isRunningRef = useRef(false);
  const currentStimulusRef = useRef(null);

  // Raw data collection refs
  const testDataRef = useRef({
    testStartTime: 0,
    testEndTime: 0,
    stimuliPresented: [],
    responses: [],
    settings: testSettings
  });
  
  // Auth context for user data and device ID
  const { user, deviceId } = useAuth();

  // Update refs when state changes
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  
  useEffect(() => {
    currentStimulusRef.current = currentStimulus;
  }, [currentStimulus]);
  
  // Keyboard event listener
  useEffect(() => {
    if (isRunning) {
      document.addEventListener('keydown', handleKeyPress);
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [isRunning]);
   
  // Start the test
  const startTest = () => {
    // Set running state
    setIsRunning(true);
    setRemainingTime(testSettings.testDuration);

    // Call onTestStart callback if provided
    if (onTestStart) {
      onTestStart();
    }

    // Record start time
    const startTime = performance.now();
    
    // Initialize test data
    testDataRef.current = {
      testStartTime: startTime,
      testEndTime: 0,
      stimuliPresented: [],
      responses: [],
      settings: testSettings
    };
    
    // Start timer
    timerIntervalRef.current = setInterval(updateTimerDisplay, 1000);
    
    // Start presenting stimuli
    stimulusTimeoutRef.current = setTimeout(presentStimulus, 1000);
  };
  
  // Update timer display
  const updateTimerDisplay = () => {
    setRemainingTime(prev => {
      const newRemainingTime = prev - 1000;
      
      if (newRemainingTime <= 0) {
        endTest();
        return 0;
      }
      
      return newRemainingTime;
    });
  };
  
  // Present a stimulus
  const presentStimulus = useCallback(() => {
    if (!isRunningRef.current) return;
    
    // Determine stimulus type and value
    const isTarget = Math.random() < testSettings.targetProbability;
    let stimulus;
    if (isTarget) {
      const randomIndex = Math.floor(Math.random() * testSettings.targets.length);
      stimulus = testSettings.targets[randomIndex];
    } else {
      const randomIndex = Math.floor(Math.random() * testSettings.nonTargets.length);
      stimulus = testSettings.nonTargets[randomIndex];
    }
    
    // Record presentation time
    const currentTime = performance.now();
    stimulusStartTimeRef.current = currentTime;
    
    // Create new stimulus object
    const newStimulus = {
      value: stimulus,
      isTarget: isTarget,
      responded: false
    };
    
    // Update state and ref
    currentStimulusRef.current = newStimulus;
    setCurrentStimulus(newStimulus);
    
    // Record stimulus presentation in test data
    testDataRef.current.stimuliPresented.push({
      value: stimulus,
      isTarget: isTarget,
      presentedAt: currentTime - testDataRef.current.testStartTime
    });
    
    // Set timeout to hide stimulus and schedule next one
    stimulusTimeoutRef.current = setTimeout(() => {
      // Clear current stimulus
      currentStimulusRef.current = null;
      setCurrentStimulus(null);
      
      // Schedule next stimulus
      stimulusTimeoutRef.current = setTimeout(
        presentStimulus,
        testSettings.interStimulusInterval - testSettings.stimulusDuration
      );
    }, testSettings.stimulusDuration);
  }, [testSettings]);
  
  // Handle key press events
  const handleKeyPress = useCallback((event) => {
    // Only respond to spacebar
    if (event.code !== 'Space' || !isRunningRef.current || !currentStimulusRef.current) return;
    
    // Prevent page scrolling
    event.preventDefault();
    
    // Calculate response time
    const currentTime = performance.now();
    const responseTime = currentTime - stimulusStartTimeRef.current;
    
    // Mark stimulus as responded
    const stimulus = currentStimulusRef.current;
    stimulus.responded = true;
    
    // Record response
    testDataRef.current.responses.push({
      stimulus: stimulus.value,
      isTarget: stimulus.isTarget,
      responseTime: responseTime,
      stimulusIndex: testDataRef.current.stimuliPresented.length - 1
    });
  }, []);
  
  // End the test
  const endTest = () => {
    // Stop test
    setIsRunning(false);
    setIsComplete(true);
    
    // Record end time
    const testEndTime = performance.now();
    testDataRef.current.testEndTime = testEndTime;
    
    // Clear intervals and timeouts
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (stimulusTimeoutRef.current) {
      clearTimeout(stimulusTimeoutRef.current);
      stimulusTimeoutRef.current = null;
    }
    
    // Call onTestEnd with the raw data
    if (onTestEnd) {
      onTestEnd(testDataRef.current);
    }
  };
  
  // Render intro screen
  const renderIntroScreen = () => (
    <div className="cpt-intro">
        <h3>Continuous Performance Test</h3>
        <div className="cpt-instructions">
            <p>This test measures your attention and response control.</p>
            <p><strong>Instructions:</strong></p>
            <ul>
                <li>You will see letters appear on the screen one at a time</li>
                <li>Press the spacebar when you see the letter '{testSettings.targets[0]}'</li>
                <li>Do NOT press any key for other letters</li>
                <li>Try to respond as quickly and accurately as possible</li>
                <li>The test will take {testSettings.testDuration / 1000 / 60} minutes to complete</li>
            </ul>
            <p>Click 'Start Test' when you're ready to begin.</p>
        </div>
        <button className="submit-button" onClick={startTest}>
            Start Test
        </button>
    </div>
);
  
  // Render test screen
  const renderTestScreen = () => (
    <div className="cpt-test-container">
        <div className="cpt-timer">
            Time Remaining: <span id="cpt-time-remaining">
                {formatTime(remainingTime)}
            </span>
        </div>
        <div className="cpt-stimulus-container">
            <div id="cpt-stimulus">
                {currentStimulus ? currentStimulus.value : ''}
            </div>
        </div>
        <div className="cpt-instructions-small">
            <p>Press spacebar for '{testSettings.targets[0]}' only</p>
        </div>
    </div>
);
  
  // Render results screen
  const renderResultsScreen = () => (
    <div className="cpt-completion-message">
        <p>Test completed! Your results have been saved.</p>
        <p>You can now proceed to the next question.</p>
    </div>
);
     
  // Main render
  if (isComplete) {
    return renderResultsScreen();
  } else if (isRunning) {
    return renderTestScreen();
  } else {
    return renderIntroScreen();
  }
}