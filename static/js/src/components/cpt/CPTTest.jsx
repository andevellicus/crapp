//static/js/src/components/cpt/CPTTest.jsx
import { useAuth } from '../../context/AuthContext';

export default function CPTTest({ onTestEnd, settings }) {
    // Default settings will be overridden by props when available
    const DEFAULT_SETTINGS = {
      testDuration: 120000, // 2 minutes in milliseconds
      stimulusDuration: 250, // Time stimulus is displayed (ms)
      interStimulusInterval: 2000, // Time between stimuli (ms)
      targetProbability: 0.7, // Probability of target stimulus
      targets: ['X'], // Target stimuli that require response
      nonTargets: ['A', 'B', 'C', 'E', 'F', 'H', 'K', 'L'], // Non-target stimuli to ignore
    };
    
    // Merge default settings with provided settings
    const testSettings = settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
    
    const [isRunning, setIsRunning] = React.useState(false);
    const [isComplete, setIsComplete] = React.useState(false);
    const [currentStimulus, setCurrentStimulus] = React.useState(null);
    const [stimulusStartTime, setStimulusStartTime] = React.useState(0);
    const [remainingTime, setRemainingTime] = React.useState(testSettings.testDuration);
    const [testState, setTestState] = React.useState({
      testStartTime: 0,
      testEndTime: 0,
      stimuliPresented: [],
      responses: [],
      correctDetections: 0,
      commissionErrors: 0,
      omissionErrors: 0,
      reactionTimes: []
    });
    const [results, setResults] = React.useState(null);
    
    // References for timeouts and intervals
    const timerIntervalRef = React.useRef(null);
    const stimulusTimeoutRef = React.useRef(null);
    
    // Check if user is admin
    const { user } = useAuth();
    const isAdmin = user?.is_admin;

    const isRunningRef = React.useRef(isRunning);

    React.useEffect(() => {
      isRunningRef.current = isRunning;
    }, [isRunning]);
    
    // Effect to handle keyboard events
    React.useEffect(() => {
      if (isRunning) {
        document.addEventListener('keydown', handleKeyPress);
      }
      return () => {
        document.removeEventListener('keydown', handleKeyPress);
      };
    }, [isRunning]);
    
    // Format time as MM:SS
    const formatTime = (milliseconds) => {
      const totalSeconds = Math.ceil(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    // Start the test
    const startTest = () => {
      setIsRunning(true);
      setRemainingTime(testSettings.testDuration);
      
      const startTime = performance.now();
      
      setTestState({
        ...testState,
        testStartTime: startTime,
        stimuliPresented: [],
        responses: [],
        correctDetections: 0,
        commissionErrors: 0,
        omissionErrors: 0,
        reactionTimes: []
      });
      
      // Start timer
      timerIntervalRef.current = setInterval(updateTimerDisplay, 1000);
      
      // Present first stimulus after a short delay
      stimulusTimeoutRef.current = setTimeout(presentStimulus, 1000);
    };
    
    // Update timer display
    const updateTimerDisplay = () => {
      setRemainingTime(prev => {
        const newRemainingTime = prev - 1000;
        
        // Check if test should end
        if (newRemainingTime <= 0) {
          endTest();
          return 0;
        }
        
        return newRemainingTime;
      });
    };
    
    // Present a stimulus
    const presentStimulus = () => {
      if (!isRunningRef.current) return;
    
      // Determine if this should be a target or non-target
      const isTarget = Math.random() < testSettings.targetProbability;
      let stimulus;
      if (isTarget) {
        const randomIndex = Math.floor(Math.random() * testSettings.targets.length);
        stimulus = testSettings.targets[randomIndex];
      } else {
        const randomIndex = Math.floor(Math.random() * testSettings.nonTargets.length);
        stimulus = testSettings.nonTargets[randomIndex];
      }
    
      const currentTime = performance.now();
      setStimulusStartTime(currentTime);
    
      // Create a local copy of the stimulus object
      const newStimulus = {
        value: stimulus,
        isTarget: isTarget,
        responseTime: null,
        responded: false,
        correct: null
      };
    
      // Set the current stimulus with the newly created object
      setCurrentStimulus(newStimulus);
    
      // Record the stimulus in the test state
      setTestState(prev => ({
        ...prev,
        stimuliPresented: [
          ...prev.stimuliPresented,
          {
            value: stimulus,
            isTarget: isTarget,
            presentedAt: currentTime - prev.testStartTime
          }
        ]
      }));
    
      // Set a timeout to hide the stimulus after the stimulusDuration
      stimulusTimeoutRef.current = setTimeout(() => {
        // Use newStimulus instead of the state variable currentStimulus
        setTestState(prev => {
          let newState = { ...prev };
          // If no response was recorded for a target, count as omission error
          if (isTarget && !newStimulus.responded) {
            newState.omissionErrors += 1;
          }
          return newState;
        });
    
        // Clear the current stimulus so that it disappears from the screen
        setCurrentStimulus(null);
    
        // Schedule the next stimulus after the interStimulusInterval minus the stimulusDuration
        stimulusTimeoutRef.current = setTimeout(
          presentStimulus,
          testSettings.interStimulusInterval - testSettings.stimulusDuration
        );
      }, testSettings.stimulusDuration);
    };
    
    // Handle key press events
    const handleKeyPress = (event) => {
      // Only respond to spacebar
      if (event.code !== 'Space' || !isRunning || !currentStimulus) return;
      
      // Prevent default (page scrolling)
      event.preventDefault();
      
      // Get response time
      const responseTime = performance.now() - stimulusStartTime;
      
      // Mark as responded
      setCurrentStimulus(prev => {
        if (!prev) return null;
        return {
          ...prev,
          responded: true,
          responseTime: responseTime
        };
      });
      
      // Update test state
      setTestState(prev => {
        const newState = { ...prev };
        
        if (currentStimulus) {
          // Record response
          newState.responses = [
            ...newState.responses,
            {
              stimulus: currentStimulus.value,
              isTarget: currentStimulus.isTarget,
              responseTime: responseTime,
              stimulusIndex: newState.stimuliPresented.length - 1
            }
          ];
          
          // Check if response is correct
          if (currentStimulus.isTarget) {
            // Correct detection of target
            newState.correctDetections += 1;
            newState.reactionTimes = [...newState.reactionTimes, responseTime];
          } else {
            // Commission error (responded to non-target)
            newState.commissionErrors += 1;
          }
        }
        
        return newState;
      });
    };
    
    // End the test
    const endTest = () => {
      // Set test as not running
      setIsRunning(false);
      setIsComplete(true);
      
      // Update test end time
      setTestState(prev => ({
        ...prev,
        testEndTime: performance.now()
      }));
      
      // Clear intervals and timeouts
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      if (stimulusTimeoutRef.current) {
        clearTimeout(stimulusTimeoutRef.current);
        stimulusTimeoutRef.current = null;
      }
      
      // Calculate final results
      calculateResults();
    };
    
    // Calculate final test results
    const calculateResults = () => {
      const { 
        testStartTime, testEndTime, stimuliPresented, 
        responses, correctDetections, commissionErrors, 
        omissionErrors, reactionTimes 
      } = testState;
      
      // Count total targets presented
      const totalTargets = stimuliPresented.filter(stim => stim.isTarget).length;
      
      // Calculate average reaction time
      let averageReactionTime = 0;
      if (reactionTimes.length > 0) {
        averageReactionTime = reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length;
      }
      
      // Calculate standard deviation of reaction times
      let reactionTimeSD = 0;
      if (reactionTimes.length > 1) {
        const mean = averageReactionTime;
        const squaredDiffs = reactionTimes.map(time => Math.pow(time - mean, 2));
        const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / reactionTimes.length;
        reactionTimeSD = Math.sqrt(variance);
      }
      
      // Calculate rates
      const detectionRate = totalTargets > 0 ? correctDetections / totalTargets : 0;
      const omissionErrorRate = totalTargets > 0 ? omissionErrors / totalTargets : 0;
      const commissionErrorRate = stimuliPresented.length - totalTargets > 0 ? 
        commissionErrors / (stimuliPresented.length - totalTargets) : 0;
      
      // Create final results object
      const finalResults = {
        testStartTime,
        testEndTime,
        correctDetections,
        commissionErrors,
        omissionErrors,
        averageReactionTime,
        reactionTimeSD,
        detectionRate,
        omissionErrorRate,
        commissionErrorRate,
        stimuliPresented,
        responses,
        settings: testSettings
      };
      
      // Set results state
      setResults(finalResults);
      
      // Call onTestEnd callback if provided
      if (onTestEnd) {
        onTestEnd(finalResults);
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
        <button id="cpt-start-button" className="submit-button" onClick={startTest}>
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
    const renderResultsScreen = () => {
      if (!results) return null;
      
      // For non-admin users, show simple completion message
      if (!isAdmin) {
        return (
          <div className="cpt-completion-message">
            <p>Test completed! You can now proceed to the next question.</p>
          </div>
        );
      }
      
      // For admin users, show detailed results
      return (
        <div className="cpt-results">
          <h3>Continuous Performance Test Results</h3>
          <div className="cpt-results-summary">
            <div className="result-item">
              <div className="result-label">Correct Detections:</div>
              <div className="result-value">{results.correctDetections}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Detection Rate:</div>
              <div className="result-value">
                {Math.round(results.detectionRate * 100)}%
              </div>
            </div>
            <div className="result-item">
              <div className="result-label">Omission Errors:</div>
              <div className="result-value">{results.omissionErrors}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Commission Errors:</div>
              <div className="result-value">{results.commissionErrors}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Average Reaction Time:</div>
              <div className="result-value">
                {Math.round(results.averageReactionTime)} ms
              </div>
            </div>
            <div className="result-item">
              <div className="result-label">Reaction Time Variability:</div>
              <div className="result-value">
                {Math.round(results.reactionTimeSD)} ms
              </div>
            </div>
          </div>
          <div className="cpt-results-interpretation">
            <p><strong>Interpretation:</strong></p>
            <ul>
              <li><strong>Correct Detections:</strong> Number of targets correctly identified</li>
              <li><strong>Detection Rate:</strong> Percentage of targets correctly identified</li>
              <li><strong>Omission Errors:</strong> Missed targets (may indicate inattention)</li>
              <li><strong>Commission Errors:</strong> Responses to non-targets (may indicate impulsivity)</li>
              <li><strong>Reaction Time:</strong> Speed of response to targets</li>
              <li><strong>Reaction Time Variability:</strong> Consistency of response timing</li>
            </ul>
          </div>
          <div className="cpt-completion-message">
            <p>Test completed! You can now proceed to the next question.</p>
          </div>
        </div>
      );
    };
    
    // Main render method
    if (isComplete) {
      return renderResultsScreen();
    } else if (isRunning) {
      return renderTestScreen();
    } else {
      return renderIntroScreen();
    }
}