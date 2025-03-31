// Improved form.js with proper validation
const CRAPP = window.CRAPP || {};

CRAPP.form = {
  stateId: null,
  
  init: async function(forceNew = false) {
    // Check authentication
    if (!window.authManager || !window.authManager.isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
    
    // Initialize tracking
    if (window.interactionTracker) {
      window.interactionTracker.reset();
    }
    
    try {
      // Initialize form state on server
      const response = await window.authManager.fetchWithAuth('/api/form/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          force_new: forceNew  // Add this to force a new state
        })
      });
      
      
      if (!response.ok) throw new Error('Failed to initialize form');
      
      const data = await response.json();
      this.stateId = data.id;
      
      // Load first question
      this.loadCurrentQuestion();
      
    } catch (error) {
      console.error('Error initializing form:', error);
      CRAPP.utils.showMessage('Failed to initialize form. Please try again.', 'error');
    }
  },
  
  loadCurrentQuestion: async function() {
    try {
      const response = await window.authManager.fetchWithAuth(`/api/form/state/${this.stateId}`)
      
      if (!response.ok) throw new Error('Failed to load question');
      
      const data = await response.json();
      
      // Check if we're at the submission screen
      if (data.state === 'complete') {
        this.renderSubmitScreen(data);
      } else {
        this.renderQuestion(data);
      }
      
    } catch (error) {
      console.error('Error loading question:', error);
      CRAPP.utils.showMessage('Failed to load question. Please try again.', 'error');
    }
  },

  getQuestionAnswer: function(questionEl) {
    // Find input element based on question type
    const inputEl = questionEl.querySelector('input:checked') || 
                   questionEl.querySelector('select') || 
                   questionEl.querySelector('textarea');
    
    if (!inputEl) {
        return null;
    }
    
    // Get value based on input type
    if (inputEl.type === 'radio') {
        return inputEl.value;
    } else if (inputEl.tagName === 'SELECT') {
        return inputEl.value;
    } else {
        return inputEl.value;
    }
  },
  
  renderQuestion: function(data) {
    const formEl = document.getElementById('symptom-form');
    formEl.innerHTML = '';
    
    // Update progress indicator
    const progressEl = document.createElement('div');
    progressEl.className = 'progress-indicator';
    progressEl.textContent = `Question ${data.current_step} of ${data.total_steps}`;
    formEl.appendChild(progressEl);
    
    // Create question element
    const questionEl = this.createQuestionElement(data.question, data.previous_answer);
    formEl.appendChild(questionEl);
    
    // Add navigation buttons
    const navButtons = document.createElement('div');
    navButtons.className = 'navigation-buttons';
    
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
      // If no question element exists, just load current question
      return this.loadCurrentQuestion();
    }
  
    const questionId = questionEl.dataset.questionId;
    
    // If going to next question, validate first (don't validate when going back)
    if (questionId !== "navigation" && !this.validateCurrentQuestion(questionEl)) {
      return false;
    }
    
    // Get answer based on question type
    let answer = this.getQuestionAnswer(questionEl);
    
    try {
      // Send answer to server for validation and progress update
      const response = await window.authManager.fetchWithAuth(`/api/form/state/${this.stateId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: questionId,
          answer: answer,
          direction: direction
        })
      });
      
      // Handle successful response
      if (response.ok) {
        const data = await response.json();
        // Load the next/previous question
        this.loadCurrentQuestion();
        return true;
      }
      
      // Handle validation errors from server
      const data = await response.json();
      if (data.errors && data.errors.length > 0) {
        // Clear previous validation messages
        this.clearValidationMessages();
        
        // Display each validation error
        data.errors.forEach(error => {
          this.showValidationMessage(questionEl, error.message);
        });
        
        // Focus on the first invalid field if possible
        if (data.field) {
          const fieldEl = questionEl.querySelector(`[name="${data.field}"]`);
          if (fieldEl) fieldEl.focus();
        }
        return false;
      } else {
        CRAPP.utils.showMessage('Failed to save your answer. Please try again.', 'error');
        return false;
      }
      
    } catch (error) {
      console.error('Error navigating:', error);
      CRAPP.utils.showMessage('Failed to save your answer. Please try again.', 'error');
      return false;
    }
  },
  
  submitForm: async function() {
    try {
      // Get interaction data if available
      let interactionData = {};
      if (window.interactionTracker) {
        interactionData = window.interactionTracker.getData();
      }
      
      // Submit form
      const response = await window.authManager.fetchWithAuth(`/api/form/state/${this.stateId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': window.authManager.getDeviceId() || 'unknown'
        },
        body: JSON.stringify({
          interaction_data: interactionData
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errors && errorData.errors.length > 0) {
          CRAPP.utils.showMessage('Please fix the validation errors before submitting.', 'error');
          // Show specific validation errors if provided
          this.showValidationErrors(errorData.errors);
          return false;
        }
        throw new Error('Failed to submit form');
      }
      
      // Show success message
      CRAPP.utils.showMessage('Your assessment has been submitted successfully!', 'success');
      
      // Reset form
      setTimeout(() => {
        // Reinitialize form after delay
        this.init();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      CRAPP.utils.showMessage('Failed to submit your assessment. Please try again.', 'error');
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
    let msgDiv = document.getElementById('message');
    
    if (!msgEl) {
      msgEl = document.createElement('span');
      msgEl.className = 'validation-message';
      msgDiv.appendChild(msgEl);
    }
    
    msgEl.textContent = message;
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