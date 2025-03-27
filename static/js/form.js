// form.js - Consolidated form handling module for CRAPP
(function(CRAPP, window) {
    'use strict';
    
    // Initialize module namespace
    CRAPP.form = CRAPP.form || {};
    
    // Dependencies
    const utils = CRAPP.utils || {};
    
    /**
     * Form Controller - Main class that handles all form functionality
     */
    class FormController {
        constructor(options = {}) {
            // DOM elements
            this.formEl = document.getElementById(options.formId || 'symptom-form');
            this.messageEl = document.getElementById('message');
            
            // Configuration
            this.config = {
                enableRandomization: options.randomizeQuestions !== false,
                saveAnswers: options.saveAnswers !== false,
                apiEndpoints: {
                    questions: options.questionsEndpoint || '/api/questions',
                    metricsProcess: options.metricsEndpoint || '/api/process-metrics',
                    submit: options.submitEndpoint || '/api/submit'
                }
            };
            
            // State
            this.state = {
                questions: [],
                questionOrder: [],
                currentIndex: 0,
                totalQuestions: 0,
                isLoading: true,
                isSubmitting: false,
                validationErrors: {}
            };
            
            // Initialize sub-components
            this.questionRenderer = new QuestionRenderer(this);
            this.formNavigation = new FormNavigation(this);
            this.formStorage = new FormStorage(this);
            
            // Initialize the form
            this.initialize();
        }
        
        /**
         * Initialize the form
         */
        async initialize() {
            try {
                // Check authentication
                if (!window.authManager || !window.authManager.isAuthenticated()) {
                    window.location.href = '/login';
                    return;
                }
                
                // Load questions
                await this.loadQuestions();
                
                // Set up event listeners
                this.setupEventListeners();
                
                // Render the first question
                this.renderCurrentQuestion();
                
                // Mark as initialized
                this.state.isLoading = false;
            } catch (error) {
                console.error('Error initializing form:', error);
                utils.showMessage('Failed to load form. Please try again later.', 'error');
            }
        }
        
        /**
         * Load questions from API
         */
        async loadQuestions() {
            try {
                // Fetch questions
                const response = await utils.apiRequest(this.config.apiEndpoints.questions);
                this.state.questions = response;
                this.state.totalQuestions = response.length;
                
                // Generate question order (randomized if enabled)
                if (this.config.enableRandomization) {
                    this.state.questionOrder = this.generateRandomOrder(this.state.totalQuestions);
                } else {
                    this.state.questionOrder = Array.from(
                        { length: this.state.totalQuestions }, 
                        (_, i) => i
                    );
                }
                
                // Restore previous state if available
                this.formStorage.restoreFormState();
            } catch (error) {
                console.error('Error loading questions:', error);
                throw error;
            }
        }
        
        /**
         * Generate random order of indices
         */
        generateRandomOrder(count) {
            const indices = Array.from({ length: count }, (_, i) => i);
            
            // Fisher-Yates shuffle
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            
            return indices;
        }
        
        /**
         * Get current question
         */
        getCurrentQuestion() {
            if (this.state.currentIndex >= this.state.questionOrder.length) {
                return null;
            }
            
            const questionIndex = this.state.questionOrder[this.state.currentIndex];
            return this.state.questions[questionIndex];
        }
        
        /**
         * Render the current question
         */
        renderCurrentQuestion() {
            // Clear form content
            this.formEl.innerHTML = '';
            
            // If we've shown all questions, render the submission screen
            if (this.state.currentIndex >= this.state.questionOrder.length) {
                this.questionRenderer.renderSubmitScreen();
                return;
            }
            
            // Get current question and render it
            const currentQuestion = this.getCurrentQuestion();
            if (currentQuestion) {
                // Create progress indicator
                const progress = this.questionRenderer.createProgressIndicator();
                this.formEl.appendChild(progress);
                
                // Create question element
                const questionEl = this.questionRenderer.createQuestionElement(currentQuestion);
                this.formEl.appendChild(questionEl);
                
                // Add navigation buttons
                const navButtons = this.formNavigation.createNavigationButtons();
                this.formEl.appendChild(navButtons);
            }
        }
        
        /**
         * Set up form event listeners
         */
        setupEventListeners() {
            // Listen for form submission
            this.formEl.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleSubmit();
            });
        }
        
        /**
         * Handle form submission
         */
        async handleSubmit() {
            if (this.state.isSubmitting) return;
            
            // Get all answers
            const answers = this.formStorage.getAllAnswers();
            
            // Validate all answers
            if (!this.validateAllAnswers(answers)) {
                utils.showMessage('Please answer all required questions before submitting.', 'error');
                // Return to first unanswered question
                this.navigateToFirstUnanswered();
                return;
            }
            
            // Set submitting state
            this.state.isSubmitting = true;
            
            try {
                // Prepare submission data
                const submissionData = this.prepareSubmissionData(answers);
                
                // Process interaction metrics
                const processedMetrics = await this.processInteractionMetrics();
                
                // Add metrics to submission
                submissionData.metadata.interaction_metrics = processedMetrics;
                submissionData.metadata.question_metrics = processedMetrics.questionMetrics;
                
                // Submit form data
                await this.submitFormData(submissionData);
                
                // Clear form state
                this.formStorage.clearFormState();
                
                // Reset to first question
                this.state.currentIndex = 0;
                this.renderCurrentQuestion();
                
                // Show success message
                utils.showMessage('Your assessment has been submitted successfully!', 'success');
                
                // Reset interaction tracking if available
                if (window.interactionTracker) {
                    window.interactionTracker.reset();
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                utils.showMessage('Error submitting form: ' + error.message, 'error');
            } finally {
                // Reset submitting state
                this.state.isSubmitting = false;
            }
        }
        
        /**
         * Navigate to first unanswered required question
         */
        navigateToFirstUnanswered() {
            const answers = this.formStorage.getAllAnswers();
            
            // Find first required question without an answer
            for (let i = 0; i < this.state.questions.length; i++) {
                const question = this.state.questions[i];
                
                if (question.required && !answers[question.id]) {
                    // Find this question's position in the question order
                    const index = this.state.questionOrder.findIndex(idx => idx === i);
                    if (index !== -1) {
                        this.state.currentIndex = index;
                        this.renderCurrentQuestion();
                        break;
                    }
                }
            }
        }
        
        /**
         * Prepare form data for submission
         */
        prepareSubmissionData(answers) {
            // Build submission data
            return {
                user_email: window.authManager.getCurrentUser().email,
                device_id: window.authManager.getDeviceId(),
                responses: answers,
                metadata: {
                    user_agent: navigator.userAgent,
                    screen_size: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    timestamp: new Date().toISOString(),
                    question_order: this.state.questionOrder
                }
            };
        }
        
        /**
         * Process interaction metrics
         */
        async processInteractionMetrics() {
            // Get raw interaction data
            const rawInteractions = window.interactionTracker ? 
                window.interactionTracker.getData() : {};
            
            try {
                // Process metrics on server
                return await utils.apiRequest(this.config.apiEndpoints.metricsProcess, {
                    method: 'POST',
                    body: rawInteractions
                });
            } catch (error) {
                console.error('Error processing metrics:', error);
                return {}; // Return empty metrics if processing fails
            }
        }
        
        /**
         * Submit form data to server
         */
        async submitFormData(submissionData) {
            try {
                // Submit to server
                const response = await utils.apiRequest(this.config.apiEndpoints.submit, {
                    method: 'POST',
                    body: submissionData
                });
                
                return response;
            } catch (error) {
                console.error('Error submitting form data:', error);
                throw error;
            }
        }
        
        /**
         * Validate all answers
         */
        validateAllAnswers(answers) {
            let isValid = true;
            
            // Reset validation errors
            this.state.validationErrors = {};
            
            // Check that required questions have answers
            for (const question of this.state.questions) {
                if (question.required && !answers[question.id]) {
                    isValid = false;
                    this.state.validationErrors[question.id] = 'This question requires an answer';
                }
            }
            
            return isValid;
        }
        
        /**
         * Navigate to next or previous question
         */
        navigate(direction) {
            // Save current answers
            const currentQuestion = this.getCurrentQuestion();
            if (currentQuestion) {
                this.formStorage.saveCurrentAnswer(currentQuestion.id);
            }
            
            // Validate if going forward
            if (direction === 'next' && !this.validateCurrentQuestion()) {
                return false;
            }
            
            // Update index
            if (direction === 'next') {
                this.state.currentIndex++;
            } else if (direction === 'prev') {
                this.state.currentIndex--;
                if (this.state.currentIndex < 0) this.state.currentIndex = 0;
            }
            
            // Render the new question
            this.renderCurrentQuestion();
            return true;
        }
        
        /**
         * Validate current question
         */
        validateCurrentQuestion() {
            const currentQuestion = this.getCurrentQuestion();
            if (!currentQuestion || !currentQuestion.required) return true;
            
            // Get value from DOM
            let value = null;
            const questionEl = this.formEl.querySelector(`[data-question-id="${currentQuestion.id}"]`);
            
            if (!questionEl) return true;
            
            // Get value based on question type
            switch (currentQuestion.type) {
                case 'radio':
                    value = questionEl.querySelector(`input[name="${currentQuestion.id}"]:checked`)?.value;
                    break;
                case 'dropdown':
                    value = questionEl.querySelector(`select[name="${currentQuestion.id}"]`)?.value;
                    break;
                case 'text':
                    value = questionEl.querySelector(`textarea[name="${currentQuestion.id}"]`)?.value;
                    break;
            }
            
            const isValid = value !== null && value !== undefined && value !== '';
            
            if (!isValid) {
                utils.showValidationMessage(questionEl, 
                    'Please complete this question before continuing.');
            }
            
            return isValid;
        }
    }
    
    /**
     * QuestionRenderer - Responsible for rendering questions and form UI
     */
    class QuestionRenderer {
        constructor(controller) {
            this.controller = controller;
        }
        
        /**
         * Create progress indicator
         */
        createProgressIndicator() {
            const progressEl = document.createElement('div');
            progressEl.className = 'progress-indicator';
            
            const current = this.controller.state.currentIndex + 1;
            const total = this.controller.state.totalQuestions;
            const display = Math.min(current, total);
            
            progressEl.textContent = `Question ${display} of ${total}`;
            return progressEl;
        }
        
        /**
         * Create question element based on type
         */
        createQuestionElement(question) {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.dataset.questionId = question.id;
            
            // Add title and description
            const titleEl = document.createElement('h3');
            titleEl.textContent = question.title;
            div.appendChild(titleEl);
            
            if (question.description) {
                const descEl = document.createElement('p');
                descEl.textContent = question.description;
                div.appendChild(descEl);
            }
            
            // Add appropriate input based on question type
            switch (question.type) {
                case 'radio':
                    this.renderRadioOptions(div, question);
                    break;
                case 'dropdown':
                    this.renderDropdown(div, question);
                    break;
                case 'text':
                    this.renderTextInput(div, question);
                    break;
            }
            
            // Mark required questions
            if (question.required) {
                div.classList.add('required-question');
            }
            
            // Restore answer if available
            setTimeout(() => this.controller.formStorage.restoreAnswer(question.id), 0);
            
            return div;
        }
        
        /**
         * Render radio button options
         */
        renderRadioOptions(container, question) {
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'symptom-scale';
            
            question.options.forEach(option => {
                const label = document.createElement('label');
                label.className = 'option-label';
                
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = question.id;
                input.value = option.value;
                if (question.required) {
                    input.required = true;
                }
                
                const textDiv = document.createElement('div');
                textDiv.className = 'option-text';
                
                const strong = document.createElement('strong');
                strong.textContent = option.label;
                textDiv.appendChild(strong);
                
                if (option.description) {
                    textDiv.appendChild(document.createElement('br'));
                    textDiv.appendChild(document.createTextNode(option.description));
                }
                
                label.appendChild(input);
                label.appendChild(textDiv);
                optionsDiv.appendChild(label);
            });
            
            container.appendChild(optionsDiv);
        }
        
        /**
         * Render dropdown select
         */
        renderDropdown(container, question) {
            const select = document.createElement('select');
            select.name = question.id;
            select.id = question.id;
            
            if (question.required) {
                select.required = true;
            }
            
            question.options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                
                // Set default option if specified
                if (question.default_option && question.default_option === option.value) {
                    optionEl.selected = true;
                }
                
                select.appendChild(optionEl);
            });
            
            container.appendChild(select);
        }
        
        /**
         * Render text input
         */
        renderTextInput(container, question) {
            const textarea = document.createElement('textarea');
            textarea.name = question.id;
            textarea.id = question.id;
            textarea.className = 'text-input';
            
            if (question.placeholder) {
                textarea.placeholder = question.placeholder;
            }
            
            if (question.max_length) {
                textarea.maxLength = question.max_length;
            }
            
            if (question.required) {
                textarea.required = true;
            }
            
            container.appendChild(textarea);
        }
        
        /**
         * Render submit screen
         */
        renderSubmitScreen() {
            const submitDiv = document.createElement('div');
            submitDiv.className = 'submit-container';
            
            // Show completion message
            const completionMsg = document.createElement('p');
            completionMsg.className = 'completion-message';
            completionMsg.textContent = 'You have answered all the questions. Please submit your responses.';
            submitDiv.appendChild(completionMsg);
            
            // Add back button
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'nav-button prev-button';
            backBtn.textContent = 'Back to Questions';
            backBtn.addEventListener('click', () => this.controller.navigate('prev'));
            submitDiv.appendChild(backBtn);
            
            // Add submit button
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.className = 'submit-button';
            submitBtn.textContent = 'Submit';
            submitDiv.appendChild(submitBtn);
            
            this.controller.formEl.appendChild(submitDiv);
        }
    }
    
    /**
     * FormNavigation - Handles navigation between questions
     */
    class FormNavigation {
        constructor(controller) {
            this.controller = controller;
        }
        
        /**
         * Create navigation buttons
         */
        createNavigationButtons() {
            const navDiv = document.createElement('div');
            navDiv.className = 'navigation-buttons';
            
            // Previous button (if not on first question)
            if (this.controller.state.currentIndex > 0) {
                const prevBtn = document.createElement('button');
                prevBtn.type = 'button';
                prevBtn.className = 'nav-button prev-button';
                prevBtn.textContent = 'Previous';
                prevBtn.addEventListener('click', () => this.controller.navigate('prev'));
                navDiv.appendChild(prevBtn);
            }
            
            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'nav-button next-button';
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => this.controller.navigate('next'));
            navDiv.appendChild(nextBtn);
            
            return navDiv;
        }
    }
    
    /**
     * FormStorage - Handles saving and restoring form state
     */
    class FormStorage {
        constructor(controller) {
            this.controller = controller;
            this.storageKey = 'crappAnswers';
        }
        
        /**
         * Save current answer
         */
        saveCurrentAnswer(questionId) {
            if (!this.controller.config.saveAnswers) return null;
            
            let value = null;
            const questionEl = this.controller.formEl.querySelector(`[data-question-id="${questionId}"]`);
            
            if (!questionEl) return null;
            
            // Get value based on question type
            const question = this.controller.state.questions.find(q => q.id === questionId);
            if (!question) return null;
            
            switch (question.type) {
                case 'radio':
                    const selectedRadio = questionEl.querySelector(`input[name="${questionId}"]:checked`);
                    if (selectedRadio) value = selectedRadio.value;
                    break;
                case 'dropdown':
                    const dropdown = questionEl.querySelector(`select[name="${questionId}"]`);
                    if (dropdown) value = dropdown.value;
                    break;
                case 'text':
                    const textInput = questionEl.querySelector(`textarea[name="${questionId}"]`);
                    if (textInput) value = textInput.value;
                    break;
            }
            
            // Store in session storage
            if (value !== null) {
                const savedAnswers = this.getAllAnswers();
                savedAnswers[questionId] = value;
                this.saveAllAnswers(savedAnswers);
            }
            
            return value;
        }
        
        /**
         * Restore answer for a specific question
         */
        restoreAnswer(questionId) {
            if (!this.controller.config.saveAnswers) return;
            
            const savedAnswers = this.getAllAnswers();
            const savedValue = savedAnswers[questionId];
            
            if (savedValue === undefined) return;
            
            // Find the question to determine its type
            const question = this.controller.state.questions.find(q => q.id === questionId);
            if (!question) return;
            
            const questionEl = this.controller.formEl.querySelector(`[data-question-id="${questionId}"]`);
            if (!questionEl) return;
            
            // Restore based on question type
            switch (question.type) {
                case 'radio':
                    const radio = questionEl.querySelector(`input[name="${questionId}"][value="${savedValue}"]`);
                    if (radio) radio.checked = true;
                    break;
                case 'dropdown':
                    const dropdown = questionEl.querySelector(`select[name="${questionId}"]`);
                    if (dropdown) dropdown.value = savedValue;
                    break;
                case 'text':
                    const textInput = questionEl.querySelector(`textarea[name="${questionId}"]`);
                    if (textInput) textInput.value = savedValue;
                    break;
            }
        }
        
        /**
         * Get all saved answers
         */
        getAllAnswers() {
            if (!this.controller.config.saveAnswers) return {};
            
            try {
                return JSON.parse(sessionStorage.getItem(this.storageKey) || '{}');
            } catch (e) {
                return {};
            }
        }
        
        /**
         * Save all answers
         */
        saveAllAnswers(answers) {
            if (!this.controller.config.saveAnswers) return;
            
            sessionStorage.setItem(this.storageKey, JSON.stringify(answers));
        }
        
        /**
         * Clear form state
         */
        clearFormState() {
            if (!this.controller.config.saveAnswers) return;
            
            sessionStorage.removeItem(this.storageKey);
        }
        
        /**
         * Restore form state (current index, etc.)
         */
        restoreFormState() {
            // Could add functionality to restore current question index
            // For now, just making sure we have the answers loaded
            this.getAllAnswers();
        }
    }
    
    // Export the FormController to the CRAPP namespace
    CRAPP.form.FormController = FormController;
    
    // Auto-initialize if the form exists
    document.addEventListener('DOMContentLoaded', function() {
        const formEl = document.getElementById('symptom-form');
        if (formEl) {
            CRAPP.form.instance = new FormController();
        }
    });
    
})(window.CRAPP = window.CRAPP || {}, window);