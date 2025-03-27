// static/js/dynamic-form.js
document.addEventListener('DOMContentLoaded', function() {
    // Dependencies
    const utils = window.CRAPP.utils;
    
    // State management
    const formState = {
        questions: [],
        currentIndex: 0,
        totalQuestions: 0,
        questionOrder: []
    };
    
    // DOM elements
    const formContainer = document.getElementById('symptom-form');
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'progress-indicator';
    
    // Initialize form
    initForm();
    
    // --- Functions ---
    
    /**
     * Initialize the form
     */
    async function initForm() {
        // Check auth status
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
        
        try {
            // Load questions
            await loadQuestions();
            
            // Set up submission handler
            setupFormSubmission();
        } catch (error) {
            console.error('Error initializing form:', error);
            utils.showMessage('Failed to load questions. Please try again later.', 'error');
        }
    }
    
    /**
     * Load questions from API
     */
    async function loadQuestions() {
        try {
            // Fetch questions
            const data = await utils.apiRequest('/api/questions');
            formState.questions = data;
            formState.totalQuestions = data.length;
            
            // Generate random question order
            formState.questionOrder = generateRandomOrder(formState.totalQuestions);
            
            // Render the first question
            renderCurrentQuestion();
        } catch (error) {
            console.error('Error loading questions:', error);
            throw error;
        }
    }
    
    /**
     * Generate random order of indices
     */
    function generateRandomOrder(count) {
        const indices = Array.from({ length: count }, (_, i) => i);
        
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        return indices;
    }
    
    /**
     * Render the current question
     */
    function renderCurrentQuestion() {
        // Clear form
        formContainer.innerHTML = '';
        
        // Add progress indicator
        updateProgressIndicator();
        formContainer.appendChild(progressIndicator);
        
        // Check if all questions have been shown
        if (formState.currentIndex >= formState.questionOrder.length) {
            // Show submit button
            renderSubmitButton();
            return;
        }
        
        // Get current question
        const questionIndex = formState.questionOrder[formState.currentIndex];
        const question = formState.questions[questionIndex];
        
        // Create question container
        const questionDiv = createQuestionElement(question);
        formContainer.appendChild(questionDiv);
        
        // Add navigation buttons
        renderNavigationButtons();
        
        // Restore previous answer if exists
        restoreAnswers(question.id);
    }
    
    /**
     * Create question element based on type
     */
    function createQuestionElement(question) {
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
                renderRadioOptions(div, question);
                break;
            case 'dropdown':
                renderDropdown(div, question);
                break;
            case 'text':
                renderTextInput(div, question);
                break;
        }
        
        return div;
    }
    
    // Various render functions for different question types
    // Render radio button options
    function renderRadioOptions(container, question) {
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
        
        // Restore saved answer if exists
        setTimeout(() => restoreAnswers(question.id), 0);
    }
    
    // Render dropdown select
    function renderDropdown(container, question) {
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
        
        // Restore saved answer if exists
        setTimeout(() => restoreAnswers(question.id), 0);
    }
    
    // Render text input
    function renderTextInput(container, question) {
        const input = document.createElement('textarea');
        input.name = question.id;
        input.id = question.id;
        input.className = 'text-input';
        
        if (question.placeholder) {
            input.placeholder = question.placeholder;
        }
        
        if (question.max_length) {
            input.maxLength = question.max_length;
        }
        
        if (question.required) {
            input.required = true;
        }
        
        container.appendChild(input);
        
        // Restore saved answer if exists
        setTimeout(() => restoreAnswers(question.id), 0);
    }
    
    function renderNavigationButtons() {
        const navDiv = document.createElement('div');
        navDiv.className = 'navigation-buttons';
        
        // Previous button (if not on first question)
        if (formState.currentIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'nav-button prev-button';
            prevBtn.textContent = 'Previous';
            
            // Use new navigation function instead of direct event handler
            prevBtn.addEventListener('click', () => navigateToQuestion('prev'));
            navDiv.appendChild(prevBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'nav-button next-button';
        nextBtn.textContent = 'Next';
        
        // Use new navigation function
        nextBtn.addEventListener('click', () => navigateToQuestion('next'));
        navDiv.appendChild(nextBtn);
        
        formContainer.appendChild(navDiv);
    }
        
    function renderSubmitButton() {
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
        backBtn.addEventListener('click', () => navigateToQuestion('prev'));
        submitDiv.appendChild(backBtn);
        
        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit-button';
        submitBtn.textContent = 'Submit';
        submitDiv.appendChild(submitBtn);
        
        formContainer.appendChild(submitDiv);
    }
    
    /**
     * Update progress indicator
     */
    function updateProgressIndicator() {
        const current = formState.currentIndex + 1;
        const display = Math.min(current, formState.totalQuestions);
        progressIndicator.innerHTML = `Question ${display} of ${formState.totalQuestions}`;
    }
    
    /**
     * Handle navigation
     */
    function navigateToQuestion(direction) {
        // Save current answers
        saveCurrentQuestionAnswers();
        
        // Validate if going forward
        if (direction === 'next' && !validateCurrentQuestion()) {
            return;
        }
        
        // Update index
        if (direction === 'next') {
            formState.currentIndex++;
        } else if (direction === 'prev') {
            formState.currentIndex--;
            if (formState.currentIndex < 0) formState.currentIndex = 0;
        }
        
        // Render the new question
        renderCurrentQuestion();
    }
    
    /**
     * Validate current question
     */
    function validateCurrentQuestion() {
        if (formState.currentIndex >= formState.questionOrder.length) return true;
        
        const questionIndex = formState.questionOrder[formState.currentIndex];
        const question = formState.questions[questionIndex];
        
        // Skip validation if not required
        if (!question.required) return true;
        
        const questionDiv = document.querySelector(`.form-group[data-question-id="${question.id}"]`);
        if (!questionDiv) return true;
        
        let isValid = true;
        
        // Use consistent validation logic from utils
        switch (question.type) {
            case 'radio':
                const selected = questionDiv.querySelector(`input[name="${question.id}"]:checked`);
                if (!selected && question.required) {
                    isValid = false;
                    utils.showValidationMessage(questionDiv, 
                        'Please select an option before continuing.');
                }
                break;
            case 'text':
            case 'dropdown':
                const input = questionDiv.querySelector(`textarea[name="${question.id}"], select[name="${question.id}"]`);
                if ((!input || !input.value.trim()) && question.required) {
                    isValid = false;
                    utils.showValidationMessage(questionDiv, 
                        'Please complete this field before continuing.');
                }
                break;
        }
        
        return isValid;
    }
    
    /**
     * Save and restore answers
     */
    function saveCurrentQuestionAnswers() {
        if (formState.currentIndex >= formState.questionOrder.length) return;
        
        const questionIndex = formState.questionOrder[formState.currentIndex];
        const question = formState.questions[questionIndex];
        
        let value = null;
        
        // Get value based on question type
        switch (question.type) {
            case 'radio':
                const selectedRadio = document.querySelector(`input[name="${question.id}"]:checked`);
                if (selectedRadio) value = selectedRadio.value;
                break;
            case 'dropdown':
                const dropdown = document.querySelector(`select[name="${question.id}"]`);
                if (dropdown) value = dropdown.value;
                break;
            case 'text':
                const textInput = document.querySelector(`textarea[name="${question.id}"]`);
                if (textInput) value = textInput.value;
                break;
        }
        
        // Store in session storage for retrieval during submission
        if (value !== null) {
            const savedAnswers = JSON.parse(sessionStorage.getItem('crappAnswers') || '{}');
            savedAnswers[question.id] = value;
            sessionStorage.setItem('crappAnswers', JSON.stringify(savedAnswers));
        }
    }
    
    function restoreAnswers(questionId) {
        const savedAnswers = JSON.parse(sessionStorage.getItem('crappAnswers') || '{}');
        const savedValue = savedAnswers[questionId];
        
        if (savedValue === undefined) return;
        
        // Find the question to determine its type
        const question = formState.questions.find(q => q.id === questionId);
        if (!question) return;
        
        // Restore based on question type
        switch (question.type) {
            case 'radio':
                const radio = document.querySelector(`input[name="${questionId}"][value="${savedValue}"]`);
                if (radio) radio.checked = true;
                break;
            case 'dropdown':
                const dropdown = document.querySelector(`select[name="${questionId}"]`);
                if (dropdown) dropdown.value = savedValue;
                break;
            case 'text':
                const textInput = document.querySelector(`textarea[name="${questionId}"]`);
                if (textInput) textInput.value = savedValue;
                break;
        }
    }
    
    /**
     * Set up form submission
     */
    function setupFormSubmission() {
        formContainer.addEventListener('submit', handleFormSubmission);
    }
    
    /**
     * Handle form submission
     */
    async function handleFormSubmission(event) {
        event.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }
        
        // Prepare data
        const submissionData = prepareFormData();
        
        try {
            // Process interaction metrics and submit data
            await submitData(submissionData);
            
            // Success!
            utils.showMessage('Your assessment has been submitted successfully!', 'success');
            
            // Reset form
            resetForm();
        } catch (error) {
            console.error('Error submitting form:', error);
            utils.showMessage('Error submitting form: ' + error.message, 'error');
        }
    }
    
    /**
     * Validate entire form
     */
    function validateForm() {
        const savedAnswers = JSON.parse(sessionStorage.getItem('crappAnswers') || '{}');
        let isValid = true;
        
        // Check that required questions have answers
        for (const question of formState.questions) {
            if (question.required && !savedAnswers[question.id]) {
                isValid = false;
                utils.showMessage(`Please answer all required questions before submitting.`, 'error');
                break;
            }
        }
        
        return isValid;
    }
    
    /**
     * Prepare form data for submission
     */
    function prepareFormData() {
        // Collect all answers from session storage
        const savedAnswers = JSON.parse(sessionStorage.getItem('crappAnswers') || '{}');
        
        // Build submission data
        const data = {
            user_email: window.authManager.getCurrentUser().email,
            device_id: window.authManager.getDeviceId(),
            responses: {},
            metadata: {
                user_agent: navigator.userAgent,
                screen_size: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                timestamp: new Date().toISOString(),
                question_order: formState.questionOrder
            }
        };
        
        // Add all saved answers to responses object with proper type conversion
        for (const [key, value] of Object.entries(savedAnswers)) {
            // Find question to determine type
            const question = formState.questions.find(q => q.id === key);
            if (question && question.type === 'radio') {
                // Convert numeric values to integers
                data.responses[key] = !isNaN(value) ? parseInt(value) : value;
            } else {
                data.responses[key] = value;
            }
        }
        
        return data;
    }
    
    /**
     * Submit data to API with interaction metrics
     */
    async function submitData(data) {
        // First process interaction metrics on server
        const rawInteractions = window.interactionTracker.getData();
        
        // Process metrics on server
        const processedMetrics = await utils.apiRequest('/api/process-metrics', {
            method: 'POST',
            body: rawInteractions
        });
        
        // Add processed metrics to submission
        data.metadata.interaction_metrics = processedMetrics;
        data.metadata.question_metrics = processedMetrics.questionMetrics;
        
        // Submit the complete assessment
        return utils.apiRequest('/api/submit', {
            method: 'POST',
            body: data
        });
    }
    
    /**
     * Reset form after submission
     */
    function resetForm() {
        // Clear saved answers
        sessionStorage.removeItem('crappAnswers');
        
        // Reset state
        formState.currentIndex = 0;
        
        // Generate new random order
        formState.questionOrder = generateRandomOrder(formState.totalQuestions);
        
        // Reset interaction tracker
        if (window.interactionTracker) {
            window.interactionTracker.reset();
        }
        
        // Render first question
        renderCurrentQuestion();
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
});