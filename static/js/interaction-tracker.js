// static/js/interaction-tracker.js - Enhanced with keyboard dynamics

class InteractionTracker {
    constructor() {
        // Store mouse movements
        this.movements = [];
        
        // Store mouse clicks and interactions with elements
        this.interactions = [];
        
        // Store keyboard events
        this.keyboardEvents = [];
        
        // Store metrics per question
        this.questionMetrics = {};
        
        // Timestamp when tracking began
        this.startTime = performance.now();
        
        // Currently tracked target element (when mouse is over it)
        this.currentTarget = null;
        
        // Current question being interacted with
        this.currentQuestion = null;
        
        // Set up event listeners
        this.setupListeners();
        
        // Throttling variables for mouse movement
        this.lastRecordedTime = 0;
        this.throttleInterval = 20; // Record every 20ms at most
    }
    
    setupListeners() {
        // Track mouse movements (throttled)
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // Track keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Set up a mutation observer to detect when new interactive elements are added
        const observer = new MutationObserver(() => {
            this.findAndTrackInteractiveElements();
            this.detectCurrentQuestion();
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Initial setup for any elements already on the page
        this.findAndTrackInteractiveElements();
        this.detectCurrentQuestion();
    }
    
    // Detect which question section the user is currently viewing
        detectCurrentQuestion() {
        const questionSections = document.querySelectorAll('.form-group');
        
        questionSections.forEach(section => {
            // Get the question ID from the dataset or input name attribute
            let questionId = section.dataset.questionId;
            
            if (!questionId) {
                const inputElement = section.querySelector('input[type="radio"], input[type="text"], textarea, select');
                if (inputElement) {
                    questionId = inputElement.name;
                    section.dataset.questionId = questionId;
                    
                    // Determine metrics type based on input type
                    const inputType = inputElement.tagName.toLowerCase();
                    const metricsType = (inputType === 'textarea' || 
                                        (inputType === 'input' && inputElement.type === 'text')) 
                                        ? 'keyboard' : 'mouse';
                    
                    section.dataset.metricsType = metricsType;
                }
            }
            
            // Initialize metrics for this question if not exists
            if (questionId && !this.questionMetrics[questionId]) {
                const metricsType = section.dataset.metricsType || 'mouse';
                
                this.questionMetrics[questionId] = {
                    interactions: [],
                    movements: [],
                    keyboardEvents: [],
                    metrics: null,
                    metricsType: metricsType
                };
                
                // Track when user enters this question section
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.currentQuestion = questionId;
                        }
                    });
                }, { threshold: 0.5 });
                
                observer.observe(section);
            }
        });
    }
    
    findAndTrackInteractiveElements() {
        // Find all interactive elements
        const interactiveElements = document.querySelectorAll('button, input, textarea, select, label.option-label');
        
        // Add tracking to each element
        interactiveElements.forEach(element => {
            // Skip if already tracked
            if (element.dataset.tracked) return;
            
            // Mark as tracked
            element.dataset.tracked = 'true';
            element.dataset.targetId = Math.random().toString(36).substring(2, 10);
            
            // Determine which question this element belongs to
            let questionId = null;
            let parentForm = element.closest('.form-group');
            if (parentForm) {
                questionId = parentForm.dataset.questionId;
                if (!questionId) {
                    const inputElement = parentForm.querySelector('input, textarea, select');
                    if (inputElement) {
                        questionId = inputElement.name;
                    }
                }
            } else if (element.tagName.toLowerCase() === 'button') {
                questionId = 'submit';
            }
            
            element.dataset.questionId = questionId;
            
            // Store original position and dimensions
            const rect = element.getBoundingClientRect();
            const targetData = {
                id: element.dataset.targetId,
                element: element,
                questionId: questionId,
                x: rect.left + rect.width/2,
                y: rect.top + rect.height/2,
                width: rect.width,
                height: rect.height,
                type: element.tagName.toLowerCase(),
                label: element.textContent?.trim() || element.value || element.id
            };
            
            // Track mouseover events to detect when user is aiming for this target
            element.addEventListener('mouseover', () => {
                this.currentTarget = targetData;
            });
            
            // Track clicks on the element
            element.addEventListener('click', (event) => this.handleInteraction(event, targetData));
            
            // Track focus and blur for keyboard inputs
            if (element.tagName.toLowerCase() === 'input' || 
                element.tagName.toLowerCase() === 'textarea' || 
                element.tagName.toLowerCase() === 'select') {
                
                element.addEventListener('focus', () => {
                    this.currentQuestion = questionId;
                });
            }
        });
    }
    
    handleMouseMove(event) {
        // Throttle recording to reduce data volume
        const now = performance.now();
        if (now - this.lastRecordedTime < this.throttleInterval) return;
        
        this.lastRecordedTime = now;
        const timestamp = now - this.startTime;
        
        // Record mouse movement
        const movementData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: timestamp,
            targetId: this.currentTarget?.id,
            questionId: this.currentQuestion
        };
        
        this.movements.push(movementData);
        
        // Also store in per-question metrics if applicable
        if (this.currentQuestion && this.questionMetrics[this.currentQuestion]) {
            this.questionMetrics[this.currentQuestion].movements.push(movementData);
        }
    }
    
    handleKeyDown(event) {
        // Skip modifier keys when alone
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
            return;
        }
        
        const timestamp = performance.now() - this.startTime;
        
        // Record keydown event (don't store the actual key for privacy, just metadata)
        const keyEvent = {
            type: 'keydown',
            key: event.key, // Consider anonymizing this for privacy
            isModifier: event.ctrlKey || event.shiftKey || event.altKey || event.metaKey,
            timestamp: timestamp,
            questionId: this.currentQuestion
        };
        
        this.keyboardEvents.push(keyEvent);
        
        // Also store in per-question metrics if applicable
        if (this.currentQuestion && this.questionMetrics[this.currentQuestion]) {
            this.questionMetrics[this.currentQuestion].keyboardEvents.push(keyEvent);
        }
    }
    
    handleKeyUp(event) {
        // Skip modifier keys when alone
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
            return;
        }
        
        const timestamp = performance.now() - this.startTime;
        
        // Record keyup event (don't store the actual key for privacy, just metadata)
        const keyEvent = {
            type: 'keyup',
            key: event.key, // Consider anonymizing this for privacy
            isModifier: event.ctrlKey || event.shiftKey || event.altKey || event.metaKey,
            timestamp: timestamp,
            questionId: this.currentQuestion
        };
        
        this.keyboardEvents.push(keyEvent);
        
        // Also store in per-question metrics if applicable
        if (this.currentQuestion && this.questionMetrics[this.currentQuestion]) {
            this.questionMetrics[this.currentQuestion].keyboardEvents.push(keyEvent);
        }
    }
    
    handleInteraction(event, targetData) {
        const rect = targetData.element.getBoundingClientRect();
        const timestamp = performance.now() - this.startTime;
        const questionId = targetData.questionId;
        
        // Update position data (in case elements moved)
        targetData.x = rect.left + rect.width/2;
        targetData.y = rect.top + rect.height/2;
        
        // Calculate precision metrics
        const clickX = event.clientX;
        const clickY = event.clientY;
        
        // Distance from center of target
        const distanceFromCenter = Math.sqrt(
            Math.pow(clickX - targetData.x, 2) + 
            Math.pow(clickY - targetData.y, 2)
        );
        
        // Normalized distance (0-1 scale where 0 is perfect center)
        const normalizedDistance = distanceFromCenter / 
            Math.sqrt(Math.pow(targetData.width/2, 2) + Math.pow(targetData.height/2, 2));
        
        // Calculate approach metrics if we have movement data
        let approach = null;
        if (this.movements.length > 0) {
            // Get last few movements before the click
            const relevantMovements = this.movements
                .filter(m => m.timestamp < timestamp && m.targetId === targetData.id)
                .slice(-20); // Last 20 movements toward this target
            
            if (relevantMovements.length > 2) {
                // Calculate path efficiency
                const startPoint = relevantMovements[0];
                const directDistance = Math.sqrt(
                    Math.pow(clickX - startPoint.x, 2) + 
                    Math.pow(clickY - startPoint.y, 2)
                );
                
                let actualDistance = 0;
                for (let i = 1; i < relevantMovements.length; i++) {
                    actualDistance += Math.sqrt(
                        Math.pow(relevantMovements[i].x - relevantMovements[i-1].x, 2) + 
                        Math.pow(relevantMovements[i].y - relevantMovements[i-1].y, 2)
                    );
                }
                
                // Add distance to the final click
                actualDistance += Math.sqrt(
                    Math.pow(clickX - relevantMovements[relevantMovements.length-1].x, 2) + 
                    Math.pow(clickY - relevantMovements[relevantMovements.length-1].y, 2)
                );
                
                // Detect if there was overshoot
                const movementVectors = [];
                for (let i = 1; i < relevantMovements.length; i++) {
                    movementVectors.push({
                        x: relevantMovements[i].x - relevantMovements[i-1].x,
                        y: relevantMovements[i].y - relevantMovements[i-1].y
                    });
                }
                
                // Check for direction reversals toward the end (sign of overshoot)
                let directionChanges = 0;
                for (let i = 1; i < movementVectors.length; i++) {
                    if ((movementVectors[i].x * movementVectors[i-1].x < 0) || 
                        (movementVectors[i].y * movementVectors[i-1].y < 0)) {
                        directionChanges++;
                    }
                }
                
                // Calculate velocity
                const duration = (relevantMovements[relevantMovements.length-1].timestamp - relevantMovements[0].timestamp) / 1000; // Convert to seconds
                const averageVelocity = duration > 0 ? actualDistance / duration : 0;
                
                approach = {
                    directDistance: directDistance,
                    actualDistance: actualDistance,
                    efficiency: directDistance / (actualDistance || 1), // Avoid division by zero
                    directionChanges: directionChanges,
                    duration: duration,
                    averageVelocity: averageVelocity
                };
            }
        }
        
        // Record the interaction
        const interaction = {
            targetId: targetData.id,
            targetType: targetData.type,
            targetLabel: targetData.label,
            questionId: questionId,
            clickX: clickX,
            clickY: clickY,
            targetX: targetData.x,
            targetY: targetData.y,
            distanceFromCenter: distanceFromCenter,
            normalizedDistance: normalizedDistance,
            timestamp: timestamp,
            approach: approach
        };
        
        this.interactions.push(interaction);
        
        // Also store in per-question metrics if applicable
        if (questionId && this.questionMetrics[questionId]) {
            this.questionMetrics[questionId].interactions.push(interaction);
            
            // Update the metrics for this question
            this.questionMetrics[questionId].metrics = this.calculateMetricsForQuestion(questionId);
        } else if (questionId) {
            // If the question ID exists but isn't in our metrics yet, create it
            this.questionMetrics[questionId] = {
                interactions: [interaction],
                movements: [],
                keyboardEvents: [],
                metrics: null
            };
            
            // Calculate initial metrics
            this.questionMetrics[questionId].metrics = this.calculateMetricsForQuestion(questionId);
        }
    }
    
    // Calculate metrics for a specific question
    calculateMetricsForQuestion(questionId) {
        const questionData = this.questionMetrics[questionId];
        if (!questionData || questionData.interactions.length === 0) {
            return { insufficientData: true };
        }
        
        const metrics = {};
        
        // Click precision metrics
        metrics.clickCount = questionData.interactions.length;
        metrics.averageDistanceFromCenter = questionData.interactions.reduce((sum, i) => sum + i.distanceFromCenter, 0) / questionData.interactions.length;
        metrics.averageNormalizedDistance = questionData.interactions.reduce((sum, i) => sum + i.normalizedDistance, 0) / questionData.interactions.length;
        metrics.clickPrecision = 1 - metrics.averageNormalizedDistance; // Higher is better
        
        // Calculate approach metrics (if available)
        const approachData = questionData.interactions.filter(i => i.approach !== null);
        if (approachData.length > 0) {
            metrics.pathEfficiency = approachData.reduce((sum, i) => sum + i.approach.efficiency, 0) / approachData.length;
            metrics.directionChanges = approachData.reduce((sum, i) => sum + i.approach.directionChanges, 0) / approachData.length;
            metrics.overShootRate = approachData.filter(i => i.approach.directionChanges > 0).length / approachData.length;
            metrics.averageVelocity = approachData.reduce((sum, i) => sum + i.approach.averageVelocity, 0) / approachData.length;
        }
        
        // Movement variability metrics
        const questionMovements = questionData.movements;
        if (questionMovements.length > 10) {
            // Calculate velocity between consecutive points
            const velocities = [];
            for (let i = 1; i < questionMovements.length; i++) {
                const dx = questionMovements[i].x - questionMovements[i-1].x;
                const dy = questionMovements[i].y - questionMovements[i-1].y;
                const dt = (questionMovements[i].timestamp - questionMovements[i-1].timestamp) / 1000; // Convert to seconds
                
                if (dt > 0) {
                    const distance = Math.sqrt(dx*dx + dy*dy);
                    const velocity = distance / dt;
                    velocities.push(velocity);
                }
            }
            
            if (velocities.length > 0) {
                metrics.minVelocity = Math.min(...velocities);
                metrics.maxVelocity = Math.max(...velocities);
                metrics.averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
                
                // Calculate velocity variability (std dev)
                const avgVel = metrics.averageVelocity;
                const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;
                metrics.velocityStdDev = Math.sqrt(variance);
                metrics.velocityVariability = metrics.velocityStdDev / avgVel; // Coefficient of variation
            }
        }
        
        // Keyboard dynamics metrics (if available)
        const keyEvents = questionData.keyboardEvents;
        if (keyEvents.length > 0) {
            // Calculate inter-key intervals
            const keydownEvents = keyEvents.filter(e => e.type === 'keydown');
            const keyIntervals = [];
            
            for (let i = 1; i < keydownEvents.length; i++) {
                const interval = keydownEvents[i].timestamp - keydownEvents[i-1].timestamp;
                keyIntervals.push(interval);
            }
            
            // Calculate key hold times (time between keydown and keyup for same key)
            const keyHoldTimes = [];
            const keyDownMap = new Map(); // Map to track keydown events by key
            
            keyEvents.forEach(event => {
                if (event.type === 'keydown') {
                    keyDownMap.set(event.key, event.timestamp);
                } else if (event.type === 'keyup' && keyDownMap.has(event.key)) {
                    const downTime = keyDownMap.get(event.key);
                    const holdTime = event.timestamp - downTime;
                    keyHoldTimes.push(holdTime);
                    keyDownMap.delete(event.key); // Remove from map after processing
                }
            });
            
            // Calculate typing metrics if we have enough data
            if (keyIntervals.length > 0) {
                metrics.typingSpeed = keydownEvents.length / ((keydownEvents[keydownEvents.length-1].timestamp - keydownEvents[0].timestamp) / 1000);
                metrics.averageInterKeyInterval = keyIntervals.reduce((sum, interval) => sum + interval, 0) / keyIntervals.length;
                
                // Calculate inter-key interval variability
                const avgInterval = metrics.averageInterKeyInterval;
                const intervalVariance = keyIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / keyIntervals.length;
                metrics.intervalStdDev = Math.sqrt(intervalVariance);
                metrics.typingRhythmVariability = metrics.intervalStdDev / avgInterval; // Coefficient of variation
            }
            
            if (keyHoldTimes.length > 0) {
                metrics.averageKeyHoldTime = keyHoldTimes.reduce((sum, time) => sum + time, 0) / keyHoldTimes.length;
                
                // Calculate key hold time variability
                const avgHoldTime = metrics.averageKeyHoldTime;
                const holdTimeVariance = keyHoldTimes.reduce((sum, time) => sum + Math.pow(time - avgHoldTime, 2), 0) / keyHoldTimes.length;
                metrics.holdTimeStdDev = Math.sqrt(holdTimeVariance);
                metrics.keyPressVariability = metrics.holdTimeStdDev / avgHoldTime; // Coefficient of variation
            }
            
            // Count error corrections (backspace, delete usage)
            metrics.correctionCount = keydownEvents.filter(e => e.key === 'Backspace' || e.key === 'Delete').length;
            
            // Calculate correction rate (corrections per character)
            const totalCharacters = keydownEvents.filter(e => e.key.length === 1).length; // Single character keys
            metrics.correctionRate = totalCharacters > 0 ? metrics.correctionCount / totalCharacters : 0;
            
            // Calculate typing consistency (detect pauses)
            const pauseThreshold = 1000; // 1 second pause threshold
            metrics.pauseCount = keyIntervals.filter(interval => interval > pauseThreshold).length;
            metrics.pauseRate = keyIntervals.length > 0 ? metrics.pauseCount / keyIntervals.length : 0;
        }
        
        return metrics;
    }
    
    // Get all tracking data
    getData() {
        // Calculate overall metrics
        const overallMetrics = this.calculateMetrics();
        
        // Return overall metrics and per-question metrics
        return {
            movements: this.movements,
            interactions: this.interactions,
            keyboardEvents: this.keyboardEvents,
            metrics: overallMetrics,
            questionMetrics: this.questionMetrics
        };
    }
    
    // Calculate overall metrics from the collected data
    calculateMetrics() {
        const metrics = {};
        
        // Only calculate if we have data
        if (this.interactions.length === 0) {
            return { insufficientData: true };
        }
        
        // Click precision metrics
        metrics.clickCount = this.interactions.length;
        metrics.averageDistanceFromCenter = this.interactions.reduce((sum, i) => sum + i.distanceFromCenter, 0) / this.interactions.length;
        metrics.averageNormalizedDistance = this.interactions.reduce((sum, i) => sum + i.normalizedDistance, 0) / this.interactions.length;
        metrics.clickPrecision = 1 - metrics.averageNormalizedDistance; // Higher is better
        
        // Calculate approach metrics (if available)
        const approachData = this.interactions.filter(i => i.approach !== null);
        if (approachData.length > 0) {
            metrics.pathEfficiency = approachData.reduce((sum, i) => sum + i.approach.efficiency, 0) / approachData.length;
            metrics.directionChanges = approachData.reduce((sum, i) => sum + i.approach.directionChanges, 0) / approachData.length;
            metrics.overShootRate = approachData.filter(i => i.approach.directionChanges > 0).length / approachData.length;
            metrics.averageVelocity = approachData.reduce((sum, i) => sum + i.approach.averageVelocity, 0) / approachData.length;
        }
        
        // Movement variability metrics
        if (this.movements.length > 10) {
            // Calculate velocity between consecutive points
            const velocities = [];
            for (let i = 1; i < this.movements.length; i++) {
                const dx = this.movements[i].x - this.movements[i-1].x;
                const dy = this.movements[i].y - this.movements[i-1].y;
                const dt = (this.movements[i].timestamp - this.movements[i-1].timestamp) / 1000; // Convert to seconds
                
                if (dt > 0) {
                    const distance = Math.sqrt(dx*dx + dy*dy);
                    const velocity = distance / dt;
                    velocities.push(velocity);
                }
            }
            
            if (velocities.length > 0) {
                metrics.minVelocity = Math.min(...velocities);
                metrics.maxVelocity = Math.max(...velocities);
                metrics.averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
                
                // Calculate velocity variability (std dev)
                const avgVel = metrics.averageVelocity;
                const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;
                metrics.velocityStdDev = Math.sqrt(variance);
                metrics.velocityVariability = metrics.velocityStdDev / avgVel; // Coefficient of variation
            }
        }
        
        // Keyboard dynamics metrics (if available)
        if (this.keyboardEvents.length > 0) {
            // Calculate inter-key intervals
            const keydownEvents = this.keyboardEvents.filter(e => e.type === 'keydown');
            const keyIntervals = [];
            
            for (let i = 1; i < keydownEvents.length; i++) {
                const interval = keydownEvents[i].timestamp - keydownEvents[i-1].timestamp;
                keyIntervals.push(interval);
            }
            
            // Calculate key hold times (time between keydown and keyup for same key)
            const keyHoldTimes = [];
            const keyDownMap = new Map(); // Map to track keydown events by key
            
            this.keyboardEvents.forEach(event => {
                if (event.type === 'keydown') {
                    keyDownMap.set(event.key, event.timestamp);
                } else if (event.type === 'keyup' && keyDownMap.has(event.key)) {
                    const downTime = keyDownMap.get(event.key);
                    const holdTime = event.timestamp - downTime;
                    keyHoldTimes.push(holdTime);
                    keyDownMap.delete(event.key); // Remove from map after processing
                }
            });
            
            // Calculate typing metrics if we have enough data
            if (keyIntervals.length > 0) {
                metrics.typingSpeed = keydownEvents.length / ((keydownEvents[keydownEvents.length-1].timestamp - keydownEvents[0].timestamp) / 1000);
                metrics.averageInterKeyInterval = keyIntervals.reduce((sum, interval) => sum + interval, 0) / keyIntervals.length;
                
                // Calculate inter-key interval variability
                const avgInterval = metrics.averageInterKeyInterval;
                const intervalVariance = keyIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / keyIntervals.length;
                metrics.intervalStdDev = Math.sqrt(intervalVariance);
                metrics.typingRhythmVariability = metrics.intervalStdDev / avgInterval; // Coefficient of variation
            }
            
            if (keyHoldTimes.length > 0) {
                metrics.averageKeyHoldTime = keyHoldTimes.reduce((sum, time) => sum + time, 0) / keyHoldTimes.length;
                
                // Calculate key hold time variability
                const avgHoldTime = metrics.averageKeyHoldTime;
                const holdTimeVariance = keyHoldTimes.reduce((sum, time) => sum + Math.pow(time - avgHoldTime, 2), 0) / keyHoldTimes.length;
                metrics.holdTimeStdDev = Math.sqrt(holdTimeVariance);
                metrics.keyPressVariability = metrics.holdTimeStdDev / avgHoldTime; // Coefficient of variation
            }
            
            // Count error corrections (backspace, delete usage)
            metrics.correctionCount = keydownEvents.filter(e => e.key === 'Backspace' || e.key === 'Delete').length;
            
            // Calculate correction rate (corrections per character)
            const totalCharacters = keydownEvents.filter(e => e.key.length === 1).length; // Single character keys
            metrics.correctionRate = totalCharacters > 0 ? metrics.correctionCount / totalCharacters : 0;
            
            // Calculate typing consistency (detect pauses)
            const pauseThreshold = 1000; // 1 second pause threshold
            metrics.pauseCount = keyIntervals.filter(interval => interval > pauseThreshold).length;
            metrics.pauseRate = keyIntervals.length > 0 ? metrics.pauseCount / keyIntervals.length : 0;
        }
        
        return metrics;
    }
    
    // Reset all collected data
    reset() {
        this.movements = [];
        this.interactions = [];
        this.keyboardEvents = [];
        this.questionMetrics = {};
        this.startTime = performance.now();
        this.currentTarget = null;
        this.currentQuestion = null;
    }
}

// Create a global instance
window.interactionTracker = new InteractionTracker();