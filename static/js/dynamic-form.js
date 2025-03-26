// static/js/dynamic-form.js
// Modified to display questions one at a time and randomize order

document.addEventListener('DOMContentLoaded', function() {
    let questions = [];
    let currentQuestionIndex = 0;
    let randomizedQuestionOrder = [];

    const formContainer = document.getElementById('symptom-form');
    const messageDiv = document.getElementById('message');
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'progress-indicator';
    
    // Check for authentication
    if (!window.authManager || !window.authManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    // Load and randomize questions
    async function loadQuestions() {
        try {
            const response = await fetch('/api/questions');
            if (!response.ok) {
                throw new Error('Failed to load questions');
            }
            
            questions = await response.json();
            
            // Randomize question order
            randomizedQuestionOrder = generateRandomOrder(questions.length);
            
            // Initial render
            renderCurrentQuestion();
            setupFormSubmission();
        } catch (error) {
            console.error('Error loading questions:', error);
            messageDiv.className = 'message error';
            messageDiv.innerHTML = '<h3>Error</h3><p>Failed to load questions. Please try again later.</p>';
            messageDiv.style.display = 'block';
        }
    }
    
    // Generate random order of question indices
    function generateRandomOrder(count) {
        const indices = Array.from({ length: count }, (_, i) => i);
        
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        return indices;
    }
    
    // Render the current question only
    function renderCurrentQuestion() {
        // Clear form
        formContainer.innerHTML = '';
        
        // Add progress indicator
        updateProgressIndicator();
        formContainer.appendChild(progressIndicator);
        
        if (currentQuestionIndex >= randomizedQuestionOrder.length) {
            // We've shown all questions, add submit button only
            renderSubmitButton();
            return;
        }
        
        // Get the current question based on randomized order
        const questionIndex = randomizedQuestionOrder[currentQuestionIndex];
        const question = questions[questionIndex];
        
        // Create question container
        const questionDiv = document.createElement('div');
        questionDiv.className = 'form-group';
        questionDiv.dataset.questionId = question.id;
        
        // Add question title and description
        const titleEl = document.createElement('h3');
        titleEl.textContent = question.title;
        questionDiv.appendChild(titleEl);
        
        if (question.description) {
            const descEl = document.createElement('p');
            descEl.textContent = question.description;
            questionDiv.appendChild(descEl);
        }
        
        // Render appropriate input based on type
        switch (question.type) {
            case 'radio':
                renderRadioOptions(questionDiv, question);
                break;
            case 'dropdown':
                renderDropdown(questionDiv, question);
                break;
            case 'text':
                renderTextInput(questionDiv, question);
                break;
            default:
                console.warn(`Unknown question type: ${question.type}`);
        }
        
        formContainer.appendChild(questionDiv);
        
        // Add navigation buttons
        renderNavigationButtons();
    }
    
    // Update the progress indicator
    function updateProgressIndicator() {
        const total = questions.length;
        const current = currentQuestionIndex + 1;
        let displayCurrent = current;
        if (current > total) displayCurrent = total;
        
        progressIndicator.innerHTML = `Question ${displayCurrent} of ${total}`;
    }
    
    // Render navigation buttons
    function renderNavigationButtons() {
        const navDiv = document.createElement('div');
        navDiv.className = 'navigation-buttons';
        
        // Previous button (if not on first question)
        if (currentQuestionIndex > 0) {
            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'nav-button prev-button';
            prevBtn.textContent = 'Previous';
            prevBtn.dataset.navAction = 'prev';
            
            prevBtn.addEventListener('click', handlePreviousClick);
            navDiv.appendChild(prevBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'nav-button next-button';
        nextBtn.textContent = 'Next';
        nextBtn.dataset.navAction = 'next';
        
        nextBtn.addEventListener('click', handleNextClick);
        navDiv.appendChild(nextBtn);
        
        formContainer.appendChild(navDiv);
    }
    
    // Final submit button (shown after all questions)
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
        backBtn.dataset.navAction = 'prev';
        backBtn.addEventListener('click', handlePreviousClick);
        submitDiv.appendChild(backBtn);
        
        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit-button';
        submitBtn.textContent = 'Submit';
        submitBtn.dataset.navAction = 'submit';
        submitDiv.appendChild(submitBtn);
        
        formContainer.appendChild(submitDiv);
    }
    
    // Handle previous button click
    function handlePreviousClick(event) {
        event.preventDefault();
        
        // Save current answers before moving
        saveCurrentQuestionAnswers();
        
        // Decrement question index
        currentQuestionIndex--;
        if (currentQuestionIndex < 0) currentQuestionIndex = 0;
        
        // Render the new current question
        renderCurrentQuestion();
    }
    
    // Handle next button click
    function handleNextClick(event) {
        event.preventDefault();
        
        // Save current answers
        saveCurrentQuestionAnswers();
        
        // Validate current question if required
        if (!validateCurrentQuestion()) {
            return;
        }
        
        // Increment question index
        currentQuestionIndex++;
        
        // Render the new current question
        renderCurrentQuestion();
    }
    
    // Save the current question's answers to session storage
    function saveCurrentQuestionAnswers() {
        if (currentQuestionIndex >= randomizedQuestionOrder.length) return;
        
        const questionIndex = randomizedQuestionOrder[currentQuestionIndex];
        const question = questions[questionIndex];
        
        let value = null;
        
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
    
    // Validate the current question
    function validateCurrentQuestion() {
        if (currentQuestionIndex >= randomizedQuestionOrder.length) return true;
        
        const questionIndex = randomizedQuestionOrder[currentQuestionIndex];
        const question = questions[questionIndex];
        
        // Check if question is required
        if (!question.required) return true;
        
        let isValid = true;
        let message = '';
        
        switch (question.type) {
            case 'radio':
                const selectedRadio = document.querySelector(`input[name="${question.id}"]:checked`);
                if (!selectedRadio) {
                    isValid = false;
                    message = 'Please select an option before continuing.';
                }
                break;
            case 'dropdown':
                const dropdown = document.querySelector(`select[name="${question.id}"]`);
                if (!dropdown || !dropdown.value) {
                    isValid = false;
                    message = 'Please select an option before continuing.';
                }
                break;
            case 'text':
                const textInput = document.querySelector(`textarea[name="${question.id}"]`);
                if (!textInput || !textInput.value.trim()) {
                    isValid = false;
                    message = 'Please provide an answer before continuing.';
                }
                break;
        }
        
        if (!isValid) {
            // Show validation message
            let validationMsg = document.querySelector('.validation-message');
            if (!validationMsg) {
                validationMsg = document.createElement('div');
                validationMsg.className = 'validation-message';
                formContainer.insertBefore(validationMsg, 
                    document.querySelector('.navigation-buttons'));
            }
            validationMsg.textContent = message;
            validationMsg.style.display = 'block';
            
            // Highlight required field
            const questionDiv = document.querySelector(`.form-group[data-question-id="${question.id}"]`);
            if (questionDiv) questionDiv.classList.add('highlight-required');
        }
        
        return isValid;
    }
    
    // Restore saved answers when revisiting a question
    function restoreAnswers(questionId) {
        const savedAnswers = JSON.parse(sessionStorage.getItem('crappAnswers') || '{}');
        const savedValue = savedAnswers[questionId];
        
        if (savedValue !== undefined) {
            const questionType = questions.find(q => q.id === questionId)?.type;
            
            switch (questionType) {
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
    }
    
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
    
    // Set up form submission handler
    function setupFormSubmission() {
        formContainer.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Ensure user is authenticated
            if (!window.authManager.isAuthenticated()) {
                messageDiv.className = 'message error';
                messageDiv.innerHTML = '<h3>Error</h3><p>You must be logged in to submit a report.</p>';
                messageDiv.style.display = 'block';
                return;
            }
            
            // Get interaction data from the tracker
            const interactionData = window.interactionTracker ? window.interactionTracker.getData() : {};
            
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
                    question_order: randomizedQuestionOrder
                }
            };
            
            // Add all saved answers to responses object
            for (const [key, value] of Object.entries(savedAnswers)) {
                const question = questions.find(q => q.id === key);
                if (question && question.type === 'radio') {
                    data.responses[key] = parseInt(value);
                } else {
                    data.responses[key] = value;
                }
            }
            
            // Add interaction metrics if available
            if (interactionData.metrics) {
                data.metadata.interaction_metrics = interactionData.metrics;
            }
            
            // Add question-specific metrics if available
            if (interactionData.questionMetrics) {
                data.metadata.question_metrics = {};
                
                // Process each question that has interactions
                const questionIds = Object.keys(interactionData.questionMetrics);
                
                for (const questionId of questionIds) {
                    const qData = interactionData.questionMetrics[questionId];
                    const interactions = qData.interactions || [];
                    
                    // Only process questions with actual interactions
                    if (interactions.length > 0) {                       
                        // Calculate metrics directly from interactions
                        const clickPrecision = calculateClickPrecision(interactions);
                        const pathEfficiency = calculatePathEfficiency(interactions);
                        const overShootRate = calculateOvershootRate(interactions);
                        const velocityData = calculateVelocity(qData.movements || []);
                        
                        // Store calculated metrics for this question
                        data.metadata.question_metrics[questionId] = {
                            clickPrecision: clickPrecision,
                            pathEfficiency: pathEfficiency,
                            overShootRate: overShootRate,
                            averageVelocity: velocityData.averageVelocity,
                            velocityVariability: velocityData.variability
                        };
                    }
                }
            }
            
            // Limit data size
            if (interactionData.interactions) {
                data.metadata.mouse_interactions = limitInteractions(interactionData.interactions);
            }
            if (interactionData.movements) {
                data.metadata.mouse_movements = limitMovements(interactionData.movements);
            }
            
            fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(result => {                
                // Show success message
                messageDiv.className = 'message success';
                messageDiv.innerHTML = '<h3>Thank You!</h3><p>Your report has been submitted successfully.</p>';
                if (window.authManager.currentUser.is_admin) {
                    messageDiv.innerHTML += '<p><a href="/admin/visualize">View data visualization</a></p>';
                }
                messageDiv.style.display = 'block';
                
                // Reset tracker
                if (window.interactionTracker) {
                    window.interactionTracker.reset();
                }
                
                // Clear session storage
                sessionStorage.removeItem('crappAnswers');
                
                // Reset form and back to first question
                currentQuestionIndex = 0;
                randomizedQuestionOrder = generateRandomOrder(questions.length);
                renderCurrentQuestion();
                
                // Scroll to top to see message
                window.scrollTo(0, 0);
                
                // Hide message after 10 seconds
                setTimeout(() => {
                    messageDiv.style.display = 'none';
                }, 10000);
            })
            .catch(error => {
                // Show error message
                messageDiv.className = 'message error';
                messageDiv.innerHTML = '<h3>Error</h3><p>There was a problem submitting your report. Please try again later.</p>';
                messageDiv.style.display = 'block';
                console.error('Error:', error);
            });
        });
    }
    
    // Calculate click precision from interactions
    function calculateClickPrecision(interactions) {
        if (interactions.length === 0) return 0;
        
        // Average normalized distance (0-1 where 0 is perfect)
        const avgDistance = interactions.reduce((sum, i) => {
            // Ensure normalizedDistance is between 0-1 (sometimes it's calculated wrong)
            const normalizedDist = i.normalizedDistance > 1 ? 1 : i.normalizedDistance;
            return sum + normalizedDist;
        }, 0) / interactions.length;
        
        // Convert to precision (higher is better)
        return 1 - (avgDistance > 1 ? 1 : avgDistance); 
    }
    
    // Calculate path efficiency from interactions
    function calculatePathEfficiency(interactions) {
        const approachData = interactions.filter(i => i.approach !== null);
        if (approachData.length === 0) return 0.7; // Default fallback
        
        const efficiency = approachData.reduce((sum, i) => {
            return sum + (i.approach.efficiency || 0);
        }, 0) / approachData.length;
        
        return efficiency > 1 ? 1 : efficiency; // Cap at 1
    }
    
    // Calculate overshoot rate from interactions
    function calculateOvershootRate(interactions) {
        const approachData = interactions.filter(i => i.approach !== null);
        if (approachData.length === 0) return 0.2; // Default fallback
        
        return approachData.filter(i => (i.approach.directionChanges || 0) > 0).length / approachData.length;
    }
    
    // Calculate velocity metrics from movements
    function calculateVelocity(movements) {
        if (movements.length < 2) {
            return {
                averageVelocity: 400, // Default fallback
                variability: 0.3     // Default fallback
            };
        }
        
        // Calculate velocities between consecutive points
        const velocities = [];
        for (let i = 1; i < movements.length; i++) {
            const dx = movements[i].x - movements[i-1].x;
            const dy = movements[i].y - movements[i-1].y;
            const dt = (movements[i].timestamp - movements[i-1].timestamp) / 1000; // Convert to seconds
            
            if (dt > 0) {
                const distance = Math.sqrt(dx*dx + dy*dy);
                const velocity = distance / dt;
                velocities.push(velocity);
            }
        }
        
        if (velocities.length === 0) {
            return {
                averageVelocity: 400, // Default fallback
                variability: 0.3     // Default fallback
            };
        }
        
        // Calculate average velocity
        const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
        
        // Calculate velocity variability (coefficient of variation)
        const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
        const stdDev = Math.sqrt(variance);
        const variability = stdDev / avgVelocity;
        
        return {
            averageVelocity: avgVelocity,
            variability: variability
        };
    }
    
    // Function to limit interactions (take most recent N interactions)
    function limitInteractions(interactions) {
        if (interactions.length <= 100) return interactions;
        return interactions.slice(-100);
    }
    
    // Function to limit mouse movements (take every Nth point)
    function limitMovements(movements) {
        if (movements.length <= 200) return movements;
        
        const result = [];
        const step = Math.floor(movements.length / 200);
        
        for (let i = 0; i < movements.length; i += step) {
            result.push(movements[i]);
        }
        
        return result;
    }
    
    // Start loading questions
    loadQuestions();
});