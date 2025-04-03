// static/js/components/cognitive-tests/cpt.js
window.CRAPP = window.CRAPP || {};
CRAPP.cognitiveTests = CRAPP.cognitiveTests || {};

/**
 * Continuous Performance Test (CPT) implementation
 * Measures sustained attention, response inhibition, and processing speed
 */
CRAPP.cognitiveTests.CPT = (function() {
    // Private variables
    const DEFAULT_SETTINGS = {
        testDuration: 10000, // 2 minutes in milliseconds TODO: CHANGE THIS BACK
        stimulusDuration: 250, // Time stimulus is displayed (ms)
        interStimulusInterval: 2000, // Time between stimuli (ms)
        targetProbability: 0.7, // Probability of target stimulus
        targets: ['X'], // Target stimuli that require response
        nonTargets: ['A', 'B', 'C', 'E', 'F', 'H', 'K', 'L'], // Non-target stimuli to ignore
    };

    // Test results tracking
    let results = {
        stimuliPresented: [],
        responses: [],
        correctDetections: 0,
        commissionErrors: 0, // Responding to non-targets
        omissionErrors: 0, // Missing targets
        reactionTimes: [], // Array of reaction times for correct responses
        testStartTime: 0,
        testEndTime: 0,
        settings: { ...DEFAULT_SETTINGS }
    };

    // Test state
    let testState = {
        isRunning: false,
        currentStimulus: null,
        stimulusStartTime: 0,
        currentInterval: null,
        timeoutId: null,
        container: null,
        remainingTime: 0,
        startCallback: null,
        endCallback: null,
    };

    /**
     * Initialize the CPT with container and optional settings
     * @param {HTMLElement} container - DOM element to render the test in
     * @param {Object} settings - Custom test settings (optional)
     */
    function initialize(container, settings = {}) {
        // Reset state
        resetTest();
        
        // Update settings with any custom ones
        results.settings = { ...DEFAULT_SETTINGS, ...settings };
        
        // Store container
        testState.container = container;
        
        // Setup UI
        renderIntroScreen();
    }

    /**
     * Reset test state and results
     */
    function resetTest() {
        // Reset results
        results = {
            stimuliPresented: [],
            responses: [],
            correctDetections: 0,
            commissionErrors: 0,
            omissionErrors: 0,
            reactionTimes: [],
            testStartTime: 0,
            testEndTime: 0,
            settings: { ...DEFAULT_SETTINGS }
        };
        
        // Reset state
        testState = {
            isRunning: false,
            currentStimulus: null,
            stimulusStartTime: 0,
            currentInterval: null,
            timeoutId: null,
            container: testState.container,
            remainingTime: results.settings.testDuration,
            startCallback: null,
            endCallback: null,
        };
        
        // Clear any existing intervals/timeouts
        if (testState.currentInterval) {
            clearInterval(testState.currentInterval);
        }
        if (testState.timeoutId) {
            clearTimeout(testState.timeoutId);
        }
    }

    /**
     * Render introduction screen with instructions
     */
    function renderIntroScreen() {
        if (!testState.container) return;
        
        const introHtml = `
            <div class="cpt-intro">
                <h3>Continuous Performance Test</h3>
                <div class="cpt-instructions">
                    <p>This test measures your attention and response control.</p>
                    <p><strong>Instructions:</strong></p>
                    <ul>
                        <li>You will see letters appear on the screen one at a time</li>
                        <li>Press the spacebar when you see the letter '${results.settings.targets[0]}'</li>
                        <li>Do NOT press any key for other letters</li>
                        <li>Try to respond as quickly and accurately as possible</li>
                        <li>The test will take ${results.settings.testDuration / 1000 / 60} minutes to complete</li>
                    </ul>
                    <p>Click 'Start Test' when you're ready to begin.</p>
                </div>
                <button id="cpt-start-button" class="submit-button">Start Test</button>
            </div>
        `;
        
        testState.container.innerHTML = introHtml;
        
        // Add event listener to start button
        const startButton = document.getElementById('cpt-start-button');
        if (startButton) {
            startButton.addEventListener('click', startTest);
        }
    }

    /**
     * Render the testing interface
     */
    function renderTestInterface() {
        if (!testState.container) return;
        
        const testHtml = `
            <div class="cpt-test-container">
                <div class="cpt-timer">Time Remaining: <span id="cpt-time-remaining">00:00</span></div>
                <div class="cpt-stimulus-container">
                    <div id="cpt-stimulus"></div>
                </div>
                <div class="cpt-instructions-small">
                    <p>Press spacebar for '${results.settings.targets[0]}' only</p>
                </div>
            </div>
        `;
        
        testState.container.innerHTML = testHtml;
        
        // Add keyboard event listener
        document.addEventListener('keydown', handleKeyPress);
        
        // Setup timer display
        updateTimerDisplay();
        testState.currentInterval = setInterval(updateTimerDisplay, 1000);
    }

    /**
     * Update the timer display
     */
    function updateTimerDisplay() {
        const timerElement = document.getElementById('cpt-time-remaining');
        if (!timerElement) return;
        
        // Calculate minutes and seconds
        const totalSeconds = Math.ceil(testState.remainingTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        // Format time as MM:SS
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update remaining time
        testState.remainingTime -= 1000;
        
        // Check if test should end
        if (testState.remainingTime < 0) {
            endTest();
        }
    }

    /**
     * Present a stimulus
     */
    function presentStimulus() {
        if (!testState.isRunning) return;
        
        const stimulusElement = document.getElementById('cpt-stimulus');
        if (!stimulusElement) return;
        
        // Determine if this should be a target or non-target
        const isTarget = Math.random() < results.settings.targetProbability;
        
        // Select stimulus
        let stimulus;
        if (isTarget) {
            // Use first target for simplicity
            stimulus = results.settings.targets[0];
        } else {
            // Select random non-target
            const randomIndex = Math.floor(Math.random() * results.settings.nonTargets.length);
            stimulus = results.settings.nonTargets[randomIndex];
        }
        
        // Record stimulus
        testState.currentStimulus = {
            value: stimulus,
            isTarget: isTarget,
            responseTime: null,
            responded: false,
            correct: null, // Will be determined after response/timeout
        };
        testState.stimulusStartTime = performance.now();
        
        // Add stimulus to results
        results.stimuliPresented.push({
            value: stimulus,
            isTarget: isTarget,
            presentedAt: testState.stimulusStartTime - results.testStartTime,
        });
        
        // Display stimulus
        stimulusElement.textContent = stimulus;
        
        // Set timeout to hide stimulus
        testState.timeoutId = setTimeout(() => {
            stimulusElement.textContent = '';
            
            // If no response and it was a target, count as omission error
            if (isTarget && !testState.currentStimulus.responded) {
                results.omissionErrors++;
                testState.currentStimulus.correct = false;
            } 
            // If no response and it was a non-target, count as correct
            else if (!isTarget && !testState.currentStimulus.responded) {
                testState.currentStimulus.correct = true;
            }
            
            // Schedule next stimulus
            testState.timeoutId = setTimeout(
                presentStimulus, 
                results.settings.interStimulusInterval - results.settings.stimulusDuration
            );
        }, results.settings.stimulusDuration);
    }

    /**
     * Handle key press events
     */
    function handleKeyPress(event) {
        // Only respond to spacebar
        if (event.code !== 'Space' || !testState.isRunning || !testState.currentStimulus) return;
        
        // Prevent default (page scrolling)
        event.preventDefault();
        
        // Get response time
        const responseTime = performance.now() - testState.stimulusStartTime;
        
        // Mark as responded
        testState.currentStimulus.responded = true;
        testState.currentStimulus.responseTime = responseTime;
        
        // Record response
        results.responses.push({
            stimulus: testState.currentStimulus.value,
            isTarget: testState.currentStimulus.isTarget,
            responseTime: responseTime,
            stimulusIndex: results.stimuliPresented.length - 1,
        });
        
        // Check if response is correct
        if (testState.currentStimulus.isTarget) {
            // Correct detection of target
            results.correctDetections++;
            results.reactionTimes.push(responseTime);
            testState.currentStimulus.correct = true;
        } else {
            // Commission error (responded to non-target)
            results.commissionErrors++;
            testState.currentStimulus.correct = false;
        }
    }

    /**
     * Start the test
     */
    function startTest() {
        // Reset test
        resetTest();
        
        // Set test as running
        testState.isRunning = true;
        testState.remainingTime = results.settings.testDuration;
        results.testStartTime = performance.now();
        
        // Render test interface
        renderTestInterface();
        
        // Present first stimulus after a short delay
        testState.timeoutId = setTimeout(presentStimulus, 1000);
        
        // Call start callback if provided
        if (typeof testState.startCallback === 'function') {
            testState.startCallback();
        }
    }

    /**
     * End the test
     */
    function endTest() {
        // Set test as not running
        testState.isRunning = false;
        results.testEndTime = performance.now();
        
        // Clear intervals and timeouts
        if (testState.currentInterval) {
            clearInterval(testState.currentInterval);
            testState.currentInterval = null;
        }
        if (testState.timeoutId) {
            clearTimeout(testState.timeoutId);
            testState.timeoutId = null;
        }
        
        // Remove event listener
        document.removeEventListener('keydown', handleKeyPress);
        
        // Calculate final results
        calculateResults();
        
        // Render results
        renderResultsScreen();
        
        // Call end callback if provided
        if (typeof testState.endCallback === 'function') {
            testState.endCallback(results);
        }
    }

    /**
     * Calculate final test results
     */
    function calculateResults() {
        // Calculate additional metrics
        
        // Count total targets presented
        const totalTargets = results.stimuliPresented.filter(stim => stim.isTarget).length;
        
        // Calculate averages
        results.averageReactionTime = results.reactionTimes.length > 0 ? 
            results.reactionTimes.reduce((sum, time) => sum + time, 0) / results.reactionTimes.length : 
            0;
        
        // Calculate standard deviation of reaction times
        if (results.reactionTimes.length > 1) {
            const mean = results.averageReactionTime;
            const squaredDiffs = results.reactionTimes.map(time => Math.pow(time - mean, 2));
            const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / results.reactionTimes.length;
            results.reactionTimeSD = Math.sqrt(variance);
        } else {
            results.reactionTimeSD = 0;
        }
        
        // Calculation detection rate
        results.detectionRate = totalTargets > 0 ? results.correctDetections / totalTargets : 0;
        
        // Calculate error rates
        results.omissionErrorRate = totalTargets > 0 ? results.omissionErrors / totalTargets : 0;
        results.commissionErrorRate = results.stimuliPresented.length - totalTargets > 0 ? 
            results.commissionErrors / (results.stimuliPresented.length - totalTargets) : 0;
    }

    /**
     * Render the results screen
     */
    function renderResultsScreen() {
        if (!testState.container) return;
        
        const resultsHtml = `
            <div class="cpt-results">
                <h3>Continuous Performance Test Results</h3>
                <div class="cpt-results-summary">
                    <div class="result-item">
                        <div class="result-label">Correct Detections:</div>
                        <div class="result-value">${results.correctDetections}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Detection Rate:</div>
                        <div class="result-value">${Math.round(results.detectionRate * 100)}%</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Omission Errors:</div>
                        <div class="result-value">${results.omissionErrors}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Commission Errors:</div>
                        <div class="result-value">${results.commissionErrors}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Average Reaction Time:</div>
                        <div class="result-value">${Math.round(results.averageReactionTime)} ms</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Reaction Time Variability:</div>
                        <div class="result-value">${Math.round(results.reactionTimeSD)} ms</div>
                    </div>
                </div>
                <div class="cpt-results-interpretation">
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
                <div class="cpt-completion-message">
                    <p>Test completed! You can now proceed to the next question.</p>
                </div>
            </div>
        `;
        
        testState.container.innerHTML = resultsHtml;
        
        // Show navigation buttons - no longer needed since we handle this with events
        // but we'll add a notification that the test is complete
        const statusEl = document.getElementById(`${testState.container.id.replace('-container', '')}-status`);
        if (statusEl) {
        statusEl.innerHTML = '<p class="complete">Test completed successfully. You can now proceed to the next question.</p>';
        }
    }

    /**
     * Set callback function for test start
     * @param {Function} callback - Function to call when test starts
     */
    function onTestStart(callback) {
        if (typeof callback === 'function') {
            testState.startCallback = callback;
        }
    }

    /**
     * Set callback function for test end
     * @param {Function} callback - Function to call when test ends with results parameter
     */
    function onTestEnd(callback) {
        if (typeof callback === 'function') {
            testState.endCallback = callback;
        }
    }

    /**
     * Force end the test early
     */
    function forceEndTest() {
        if (testState.isRunning) {
            endTest();
        }
    }

    // Public API
    return {
        initialize,
        startTest,
        forceEndTest,
        onTestStart,
        onTestEnd,
        getResults: () => ({ ...results }),

        isRunning: () => testState.isRunning,
        isComplete: () => !testState.isRunning && results.testEndTime > 0,
        forceComplete: function() {
            if (testState.isRunning) {
                console.log("Forcing CPT test completion");
                endTest();
                return true;
            }
            return false;
        }
    };
})();