// Simplified form.js
const CRAPP = window.CRAPP || {};

CRAPP.form = {
  stateId: null,
  
  init: async function() {
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
      const response = await fetch('/api/form/init', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to initialize form');
      
      const data = await response.json();
      this.stateId = data.id;
      
      // Load first question
      this.loadCurrentQuestion();
      
    } catch (error) {
      console.error('Error initializing form:', error);
      this.showMessage('Failed to initialize form. Please try again.', 'error');
    }
  },
  
  loadCurrentQuestion: async function() {
    try {
      const response = await fetch(`/api/form/state/${this.stateId}`, {
        headers: {
          'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
        }
      });
      
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
      this.showMessage('Failed to load question. Please try again.', 'error');
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
    
    // Append the navigation buttons to the form
    formEl.appendChild(navDiv);
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
  
  navigate: async function(direction) {
    // Get current question ID
    const questionEl = document.querySelector('[data-question-id]');
    if (!questionEl) {
      // If no question element exists, just load current question
      return this.loadCurrentQuestion();
    }
  
    const questionId = questionEl.dataset.questionId;
    
    // Get answer based on question type
    let answer = this.getQuestionAnswer(questionEl);
    
    try {
      // Send answer to server for validation and progress update
      const response = await fetch(`/api/form/state/${this.stateId}/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.authManager.getCurrentToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: questionId,
          answer: answer,
          direction: direction
        })
      });
      
      const data = await response.json();
      
      // Handle validation errors
      if (!response.ok) {
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
          this.showMessage('Failed to save your answer. Please try again.', 'error');
          return false;
        }
      }
      
      // Load the next/previous question
      this.loadCurrentQuestion();
      return true;
      
    } catch (error) {
      console.error('Error navigating:', error);
      this.showMessage('Failed to save your answer. Please try again.', 'error');
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
      const response = await fetch(`/api/form/state/${this.stateId}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.authManager.getCurrentToken()}`,
          'Content-Type': 'application/json',
          'X-Device-ID': window.authManager.getDeviceId() || 'unknown'
        },
        body: JSON.stringify({
          interaction_data: interactionData
        })
      });
      
      if (!response.ok) throw new Error('Failed to submit form');
      
      // Show success message
      this.showMessage('Your assessment has been submitted successfully!', 'success');
      
      // Reset form
      setTimeout(() => {
        // Reinitialize form after delay
        this.init();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      this.showMessage('Failed to submit your assessment. Please try again.', 'error');
    }
  },
  
  showMessage: function(message, type = 'success') {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 5000);
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