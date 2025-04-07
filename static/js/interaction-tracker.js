// Updated interaction-tracker.js with proper initialization and cleanup
class InteractionTracker {
    constructor() {
        // Basic data storage
        this.movements = [];
        this.interactions = [];
        this.keyboardEvents = [];
        this.currentQuestion = null;
        this.currentTarget = null;
        this.startTime = performance.now();
        
        // Throttling for performance
        this.lastRecordedTime = 0;
        this.throttleInterval = 50; // Record at most every 50ms
        
        // Store event listener references for proper cleanup
        this.mouseMoveListener = this.handleMouseMove.bind(this);
        this.keyDownListener = this.handleKeyDown.bind(this);
        this.keyUpListener = this.handleKeyUp.bind(this);
        
        // Initialize tracking
        this.setupListeners();
    }
    
    setupListeners() {
        // Track mouse movements (throttled)
        document.addEventListener('mousemove', this.mouseMoveListener);
        
        // Track keyboard events
        document.addEventListener('keydown', this.keyDownListener);
        document.addEventListener('keyup', this.keyUpListener);
        
        // Track questions
        this.mutationObserver = new MutationObserver(() => {
            this.findInteractiveElements();
            this.detectCurrentQuestion();
        });
        
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });
        
        // Initial setup
        this.findInteractiveElements();
        this.detectCurrentQuestion();
    }
    
    cleanup() {
        // Remove event listeners to prevent memory leaks
        document.removeEventListener('mousemove', this.mouseMoveListener);
        document.removeEventListener('keydown', this.keyDownListener);
        document.removeEventListener('keyup', this.keyUpListener);
        
        // Disconnect mutation observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        // Clear intersection observers
        if (this.intersectionObservers) {
            this.intersectionObservers.forEach(observer => observer.disconnect());
        }
    }
    
    detectCurrentQuestion() {
        this.intersectionObservers = [];
        
        document.querySelectorAll('.form-group').forEach(section => {
            let questionId = section.dataset.questionId;
            
            if (!questionId) {
                const inputElement = section.querySelector('input, textarea, select');
                if (inputElement) {
                    questionId = inputElement.name;
                    section.dataset.questionId = questionId;
                }
            }
            
            // Track when question is visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.currentQuestion = questionId;
                    }
                });
            }, { threshold: 0.5 });
            
            observer.observe(section);
            this.intersectionObservers.push(observer);
        });
    }
    
    findInteractiveElements() {
        document.querySelectorAll('button, input, textarea, select, label.option-label').forEach(element => {
            if (element.dataset.tracked) return;
            
            element.dataset.tracked = 'true';
            element.dataset.targetId = Math.random().toString(36).substring(2, 10);
            
            // Find question ID
            let questionId = null;
            let parentForm = element.closest('.form-group');
            if (parentForm) {
                questionId = parentForm.dataset.questionId;
            } else if (element.tagName.toLowerCase() === 'button') {
                questionId = element.classList.contains('nav-button') ? 'navigation' : 'submit';
            }
            
            element.dataset.questionId = questionId;
            
            // Store element position
            const rect = element.getBoundingClientRect();
            const targetData = {
                id: element.dataset.targetId,
                questionId: questionId,
                x: rect.left + rect.width/2,
                y: rect.top + rect.height/2,
                width: rect.width,
                height: rect.height,
                type: element.tagName.toLowerCase()
            };
            
            // Track events
            element.addEventListener('mouseover', () => this.currentTarget = targetData);
            element.addEventListener('click', (event) => this.handleInteraction(event, targetData));
            
            if (['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())) {
                element.addEventListener('focus', () => this.currentQuestion = questionId);
            }
        });
    }
    
    handleMouseMove(event) {
        // Throttle recording
        const now = performance.now();
        if (now - this.lastRecordedTime < this.throttleInterval) return;
        
        this.lastRecordedTime = now;
        this.movements.push({
            x: event.clientX,
            y: event.clientY,
            timestamp: now - this.startTime,
            targetId: this.currentTarget?.id,
            questionId: this.currentQuestion
        });
    }
    
    handleKeyDown(event) {
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
        
        this.keyboardEvents.push({
            type: 'keydown',
            key: event.key,
            isModifier: event.ctrlKey || event.shiftKey || event.altKey || event.metaKey,
            timestamp: performance.now() - this.startTime,
            questionId: this.currentQuestion
        });
    }
    
    handleKeyUp(event) {
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
        
        this.keyboardEvents.push({
            type: 'keyup',
            key: event.key,
            isModifier: event.ctrlKey || event.shiftKey || event.altKey || event.metaKey,
            timestamp: performance.now() - this.startTime,
            questionId: this.currentQuestion
        });
    }
    
    handleInteraction(event, targetData) {
        const rect = event.target.getBoundingClientRect();
        const timestamp = performance.now() - this.startTime;
        
        // Update position
        targetData.x = rect.left + rect.width/2;
        targetData.y = rect.top + rect.height/2;
        
        // Record interaction
        this.interactions.push({
            targetId: targetData.id,
            targetType: targetData.type,
            questionId: targetData.questionId,
            clickX: event.clientX,
            clickY: event.clientY,
            targetX: targetData.x,
            targetY: targetData.y,
            timestamp: timestamp
        });
    }
    
    // Get data - no calculations, just raw data
    getData() {
        return {
            movements: this.movements,
            interactions: this.interactions,
            keyboardEvents: this.keyboardEvents,
            startTime: this.startTime
        };
    }
    
    reset() {
        // Clear data
        this.movements = [];
        this.interactions = [];
        this.keyboardEvents = [];
        this.startTime = performance.now();
        
        // No need to reset listeners - they'll continue to track events
    }
}

// Create a singleton instance
if (!window.interactionTracker) {
    window.interactionTracker = new InteractionTracker();
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.interactionTracker) {
        window.interactionTracker.cleanup();
    }
});

export default window.interactionTracker;