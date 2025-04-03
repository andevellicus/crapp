const CRAPP = window.CRAPP || {};

CRAPP.form = {
  stateId: null,
  formAnswers: {},
  
  init: async function(forceNew = false) {
    // Check authentication
    if (!CRAPP.auth.isAuthenticated()) {
      CRAPP.auth.redirectToLogin();
      return;
    }

    // Reset form answers on initialization
    this.formAnswers = {};
    
    // Initialize tracking
    if (window.interactionTracker) {
      window.interactionTracker.reset();
    }
    
    try {
      // Initialize form state on server
      const data = await CRAPP.api.post('/api/form/init', {
        force_new: forceNew
      });
      
      this.stateId = data.id;
      
      // Load first question
      this.loadCurrentQuestion();
      
    } catch (error) {
      // Error handling is done by the API service
      // But log any errors anyway
      console.error(error)
    }
  },
  
  loadCurrentQuestion: async function() {
    try {
      const data = await CRAPP.api.get(`/api/form/state/${this.stateId}`);
      
      // Check if we're at the submission screen
      if (data.state === 'complete') {
        this.renderSubmitScreen(data);
      } else {
        this.renderQuestion(data);
      }

      // Load previous answers into formAnswers if available
      if (data.state === 'complete' && data.answers) {
        this.formAnswers = data.answers;
      }
      
    } catch (error) {
      // API service automatically handles errors
      // But log any errors anyway
      console.error(error)
    }
  },

  getQuestionAnswer: function(questionEl) {
    const questionId = questionEl.dataset.questionId;
    
    // First check if we have a cognitive test result for this question
    if (this.formAnswers && this.formAnswers[questionId]) {
      return this.formAnswers[questionId];
    }
    
    // Find input element based on question type
    const inputEl = questionEl.querySelector('input:checked') || 
                    questionEl.querySelector('select') || 
                    questionEl.querySelector('textarea');
    
    if (!inputEl) {
        return null;
    }
    
    // Get value based on input type
    let answer;
    if (inputEl.type === 'radio') {
        answer = inputEl.value;
    } else if (inputEl.tagName === 'SELECT') {
        answer = inputEl.value;
    } else {
        answer = inputEl.value;
    }
    
    // Store the answer in formAnswers
    this.formAnswers[questionId] = answer;
    
    return answer;
  },
  
  renderQuestion: function(data) {
    const formEl = document.getElementById('symptom-form');
    formEl.innerHTML = '';
    
    // Update progress indicator
    const progressEl = document.createElement('div');
    progressEl.className = 'progress-indicator';
    progressEl.textContent = `Question ${data.current_step} of ${data.total_steps}`;
    formEl.appendChild(progressEl);
    
    // Add previous answer if it exists
    if (data.previous_answer) {
      // Store the previous answer in formAnswers
      this.formAnswers[data.question.id] = data.previous_answer;
    }
    
    // Create question element based on type
    const questionEl = (data.question.type === 'cognitive_test') ? 
      this.createCognitiveTestQuestion(data.question, data.previous_answer) :
      this.createQuestionElement(data.question, data.previous_answer);
    
    formEl.appendChild(questionEl);
    
    // Add navigation buttons with an ID so we can hide/show them
    const navButtons = document.createElement('div');
    navButtons.className = 'navigation-buttons';
    navButtons.id = 'nav-buttons';
    
    // Add prev button if not on first question
    if (data.current_step > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'nav-button prev-button';
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', () => this.navigate('prev'));
      navButtons.appendChild(prevBtn);
    }
    
    // Add next button
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'nav-button next-button';
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', () => this.navigate('next'));
    navButtons.appendChild(nextBtn);
    formEl.appendChild(navButtons);

      // If this is a cognitive test, we need to handle the navigation visibility
    if (data.question.type === 'cognitive_test') {
      const navButtons = document.getElementById('nav-buttons');
      const testType = data.question.metrics_type || 'cpt';
      
      // Initial state - hide buttons if test module exists
      if (CRAPP.cognitiveTests && CRAPP.cognitiveTests[testType.toUpperCase()]) {
        const testModule = CRAPP.cognitiveTests[testType.toUpperCase()];
        
        // Check if we already have results for this question
        if (this.formAnswers && this.formAnswers[data.question.id] && 
            this.formAnswers[data.question.id].testEndTime) {
          // Test already completed - keep buttons visible
          navButtons.style.display = 'flex';
        } else {
          // Test not completed yet - hide buttons initially
          //navButtons.style.display = 'none';
          
          // Set up listeners for test events
          testModule.onTestStart(() => {
            // Hide navigation when test starts
            navButtons.style.display = 'none';
          });
          
          testModule.onTestEnd(() => {
            // Show navigation when test ends
            navButtons.style.display = 'flex';
          });
        }
      }
    }
  },

  renderRadioOptions: function(container, question, previousAnswer) {
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
      
      // Check if this option was previously selected
      if (previousAnswer !== null && previousAnswer !== undefined && 
          option.value.toString() === previousAnswer.toString()) {
        input.checked = true;
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
  },
  
  renderDropdown: function(container, question, previousAnswer) {
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
      
      // Set previously selected option
      if (previousAnswer !== null && previousAnswer !== undefined && 
          option.value.toString() === previousAnswer.toString()) {
        optionEl.selected = true;
      } else if (question.default_option && question.default_option === option.value) {
        // Set default option if specified and no previous answer
        optionEl.selected = true;
      }
      
      select.appendChild(optionEl);
    });
    
    container.appendChild(select);
  },
  
  renderTextInput: function(container, question, previousAnswer) {
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
    
    // Set previous answer if available
    if (previousAnswer !== null && previousAnswer !== undefined) {
      textarea.value = previousAnswer;
    }
    
    container.appendChild(textarea);
  },
  
  renderSubmitScreen: function(data) {
    const formEl = document.getElementById('symptom-form');
    formEl.innerHTML = '';
    
    // Show completion message
    const completionMsg = document.createElement('p');
    completionMsg.className = 'completion-message';
    completionMsg.textContent = 'You have answered all the questions. Please submit your responses.';
    formEl.appendChild(completionMsg);
    
    // Create navigation buttons container
    const navDiv = document.createElement('div');
    navDiv.className = 'navigation-buttons';
    
    // Add back button
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'nav-button prev-button';
    backBtn.textContent = 'Back to Questions';
    backBtn.addEventListener('click', () => this.navigate('prev'));
    navDiv.appendChild(backBtn);
    
    // Add submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'submit-button';
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', () => this.submitForm());
    navDiv.appendChild(submitBtn);

    // Add reset button
    const resetButtonDiv = document.createElement('div');

    // Create a "Start Over" button 
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'reset-button';
    resetButton.textContent = 'Start Over';
    resetButton.addEventListener('click', () => this.resetForm());
    resetButtonDiv.appendChild(resetButton);
    
    // Append the navigation buttons to the form
    formEl.appendChild(navDiv);
    formEl.appendChild(resetButtonDiv);
  },
  
  createQuestionElement: function(question, previousAnswer) {
    // The server returns complete question object
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
    
    // Add input based on question type
    switch (question.type) {
      case 'radio':
        this.renderRadioOptions(div, question, previousAnswer);
        break;
      case 'dropdown':
        this.renderDropdown(div, question, previousAnswer);
        break;
      case 'text':
        this.renderTextInput(div, question, previousAnswer);
        break;
    }
    
    // Mark required questions
    if (question.required) {
      div.classList.add('required-question');
    }
    
    return div;
  },

  createCognitiveTestQuestion: function(question, previousAnswer) {
    const div = document.createElement('div');
    div.className = 'form-group cognitive-test-container';
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
    
    // Container for the cognitive test
    const testContainerEl = document.createElement('div');
    testContainerEl.id = `${question.id}-container`;
    testContainerEl.className = 'cognitive-test-inner';
    div.appendChild(testContainerEl);
    
    // Mark required questions
    if (question.required) {
      div.classList.add('required-question');
    }
    
    // Initialize cognitive test after rendering
    setTimeout(() => {
      const testType = question.metrics_type;
      if (testType === 'cpt') {
        this.initializeCPTTest(testContainerEl, question);
      } else if (testType === 'trail_making') {
        // Initialize trail making test
        // To be implemented
      }
    }, 100);
    
    return div;
  },
  
  // Initialize the CPT test
  initializeCPTTest: function(container, question) {
    // Make sure CPT module is loaded
    if (!CRAPP.cognitiveTests || !CRAPP.cognitiveTests.CPT) {
      console.error('CPT module not loaded');
      container.innerHTML = '<div class="error-message">Cognitive test module failed to load. Please refresh the page.</div>';
      return;
    }
    
    // Get custom settings from question if available
    let settings = {};
    try {
      if (question.settings && typeof question.settings === 'string') {
        settings = JSON.parse(question.settings);
      } else if (question.settings && typeof question.settings === 'object') {
        settings = question.settings;
      }
    } catch (error) {
      console.warn('Failed to parse CPT settings', error);
    }
    
    // Initialize the CPT test
    CRAPP.cognitiveTests.CPT.initialize(container, settings);
    
    // Set up result callback
    CRAPP.cognitiveTests.CPT.onTestEnd((results) => {
      // Store in the form answers for internal use
      this.formAnswers[question.id] = results;
      
      // Save results in hidden input for form submission
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = question.id;
      hiddenInput.value = JSON.stringify(results);
      container.appendChild(hiddenInput);
    });
  },
  
  // New method to validate the current question
  validateCurrentQuestion: function(questionEl) {
    // Clear any existing validation messages first
    this.clearValidationMessages();
    
    // Get question ID
    const questionId = questionEl.dataset.questionId;
    
    // Check if this is a required question
    const isRequired = questionEl.classList.contains('required-question');
    
    // Get the answer
    const answer = this.getQuestionAnswer(questionEl);
    
    // If required and no answer, show error
    if (isRequired && (answer === null || answer === '')) {
      this.showValidationMessage(questionEl, "This question is required");
      return false;
    }
    
    return true;
  },
  
  navigate: async function(direction) {
    // Get current question element
    const questionEl = document.querySelector('[data-question-id]');
    if (!questionEl) {
      return this.loadCurrentQuestion();
    }
  
    const questionId = questionEl.dataset.questionId;
    
    // Validate if going to next question
    if (questionId !== "navigation" && direction === "next" && !this.validateCurrentQuestion(questionEl)) {
      return false;
    }
    
    // Get answer based on question type
    let answer = this.getQuestionAnswer(questionEl);
    
    try {
      // Use the API service instead of direct fetch
      await CRAPP.api.post(`/api/form/state/${this.stateId}/answer`, {
        question_id: questionId,
        answer: answer,
        direction: direction
      }, {}, this.handleNavigationError.bind(this, questionEl));
      
      // If successful, load the next question
      this.loadCurrentQuestion();
      return true;
      
    } catch (error) {
      // The API service already handled general errors
      // We only need to handle validation errors here
      return false;
    }
  },

  // Add a custom error handler for navigation-specific errors
  handleNavigationError: function(questionEl, error) {
    // Check if this is a validation error with field-specific details
    if (error.response && error.response.errors && error.response.errors.length > 0) {
        // Clear previous validation messages
        this.clearValidationMessages();
        
        // Display each validation error
        error.response.errors.forEach(err => {
            this.showValidationMessage(questionEl, err.message);
        });
        
        // Focus on the first invalid field
        if (error.response.field) {
            const fieldEl = questionEl.querySelector(`[name="${error.response.field}"]`);
            if (fieldEl) fieldEl.focus();
        }
        
        // Return true to indicate we've handled this error
        return true;
    }
    
    // Return false to let the API service handle generic errors
    return false;
  },
  
  submitForm: async function() {
    try {
      // Get interaction data if available
      let interactionData = {};
      if (window.interactionTracker) {
        interactionData = window.interactionTracker.getData();
      }
      
      // Extract cognitive test results from formAnswers
      const cognitiveTestResults = [];
      for (const [questionId, answer] of Object.entries(this.formAnswers)) {
        if (typeof answer === 'object' && answer !== null && 
            answer.stimuliPresented && answer.responses) {
          // This looks like a cognitive test result
          cognitiveTestResults.push({
            question_id: questionId,
            results: answer
          });
        }
      }
      
      // Build the request with all data
      const request = {
        interaction_data: interactionData
      };
      
      // Add cognitive test results if available
      if (cognitiveTestResults.length > 0) {
        request.cognitive_tests = cognitiveTestResults;
      }
      
      // Use API service to submit form
      const result = await CRAPP.api.post(`/api/form/state/${this.stateId}/submit`, request);
      
      // Show success message
      CRAPP.utils.showMessage('Your assessment has been submitted successfully!', 'success');
      
      // Reset form after delay
      setTimeout(() => {
        this.init(true);
      }, 2000);
      
    } catch (error) {
      // Error handling is done by the API service
    }
  },

  resetForm: function() {
    // Confirm before resetting
    if (confirm('Are you sure you want to start over? All your current answers will be lost.')) {
      // Call the init method to start a new form session
      CRAPP.utils.showMessage('Starting a new assessment...', 'success');
      
      // Reset the form state
      this.init(true);
    }
  },
  
  showValidationMessage: function(container, message) {
    let msgEl = container.querySelector('.validation-message');
    
    if (!msgEl) {
      msgEl = document.createElement('div');
      msgEl.className = 'validation-message';
      container.appendChild(msgEl);
    }
    
    msgEl.textContent = message;
    msgEl.style.display = 'block';
    container.classList.add('highlight-required');
    
    // Scroll to validation message
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  
  clearValidationMessages: function() {
    document.querySelectorAll('.validation-message').forEach(msg => {
      msg.style.display = 'none';
    });
    
    document.querySelectorAll('.highlight-required').forEach(el => {
      el.classList.remove('highlight-required');
    });
  },

  showValidationErrors: function(errors) {
    if (!errors || errors.length === 0) return;
    
    errors.forEach(error => {
        const questionEl = document.querySelector(`[data-question-id="${error.field}"]`);
        if (questionEl) {
            this.showValidationMessage(questionEl, error.message);
        }
    });
    
    // Scroll to first error
    const firstErrorEl = document.querySelector(`[data-question-id="${errors[0].field}"]`);
    if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('symptom-form')) {
    CRAPP.form.init();
  }
});