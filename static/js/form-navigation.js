// File: static/js/form-navigation.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    if (!window.authManager || !window.authManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    const slides = document.querySelectorAll('.question-slide');
    const currentQuestionEl = document.getElementById('current-question');
    const totalQuestions = slides.length;
    let currentSlide = 0;
    
    // Setup event listeners for navigation buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.dataset.action;
            
            // Validate current slide if going forward
            if (action === 'next' && !validateCurrentSlide()) {
                return;
            }
            
            // Navigate
            if (action === 'prev' && currentSlide > 0) {
                showSlide(currentSlide - 1);
            } else if (action === 'next' && currentSlide < totalQuestions - 1) {
                showSlide(currentSlide + 1);
            }
        });
    });
    
    // Setup form submission
    document.getElementById('symptom-form').addEventListener('submit', function(event) {
        event.preventDefault();
        
        // If not on the last slide, don't submit
        if (currentSlide < totalQuestions - 1) {
            return;
        }
        
        // Validate last slide
        if (!validateCurrentSlide()) {
            return;
        }
        
        // Get form data
        const formData = new FormData(this);
        const responses = {};
        
        // Convert to JSON object
        for (const [key, value] of formData.entries()) {
            responses[key] = value;
        }
        
        // Add interaction data
        const interactionData = window.interactionTracker ? window.interactionTracker.getData() : {};
        
        // Create submission payload
        const payload = {
            user_email: window.authManager.getCurrentUser().email,
            device_id: window.authManager.getDeviceId(),
            responses: responses,
            metadata: {
                user_agent: navigator.userAgent,
                screen_size: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                timestamp: new Date().toISOString(),
                interaction_metrics: interactionData.metrics || {},
                question_metrics: interactionData.questionMetrics || {}
            }
        };
        
        // Submit data
        submitData(payload);
    });
    
    // Helper functions
    function showSlide(index) {
        // Hide all slides
        slides.forEach(slide => {
            slide.style.display = 'none';
        });
        
        // Show the selected slide
        slides[index].style.display = 'block';
        
        // Update current slide index
        currentSlide = index;
        
        // Update progress indicator
        currentQuestionEl.textContent = index + 1;
        
        // Scroll to top of form
        document.getElementById('symptom-form').scrollIntoView({ behavior: 'smooth' });
    }
    
    function validateCurrentSlide() {
        const currentSlideEl = slides[currentSlide];
        const requiredInputs = currentSlideEl.querySelectorAll('input[required], textarea[required], select[required]');
        
        let isValid = true;
        
        requiredInputs.forEach(input => {
            // For radio buttons, check if any in the group is selected
            if (input.type === 'radio') {
                const name = input.name;
                const checked = currentSlideEl.querySelector(`input[name="${name}"]:checked`);
                
                if (!checked) {
                    isValid = false;
                    showValidationMessage(currentSlideEl, `Please select an option before continuing.`);
                }
                return;
            }
            
            // For other inputs, check if they have a value
            if (!input.value.trim()) {
                isValid = false;
                showValidationMessage(currentSlideEl, `Please complete all required fields before continuing.`);
            }
        });
        
        return isValid;
    }
    
    function showValidationMessage(slideEl, message) {
        let msgEl = slideEl.querySelector('.validation-message');
        
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.className = 'validation-message';
            slideEl.appendChild(msgEl);
        }
        
        msgEl.textContent = message;
        msgEl.style.display = 'block';
    }
    
    async function submitData(data) {
        // First, process interaction metrics on the server
        const rawInteractions = window.interactionTracker.getData();
        const messageDiv = document.getElementById('message');
        
        try {
            // Process metrics on server first
            const metricsResponse = await fetch('/api/process-metrics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                },
                body: JSON.stringify(rawInteractions)
            });
            
            if (!metricsResponse.ok) {
                throw new Error('Failed to process metrics');
            }
            
            // Get processed metrics
            const processedMetrics = await metricsResponse.json();
            
            // Update the data with processed metrics
            data.metadata.interaction_metrics = processedMetrics;
            data.metadata.question_metrics = processedMetrics.questionMetrics;
            
            // Then submit the full assessment
            const submitResponse = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                },
                body: JSON.stringify(data)
            });
            
            if (!submitResponse.ok) {
                throw new Error('Network response was not ok');
            }
            
            // Handle successful submission
            const result = await submitResponse.json();
            
            // Show success message
            messageDiv.className = 'message success';
            messageDiv.innerHTML = '<h3>Thank You!</h3><p>Your report has been submitted successfully.</p>';
            if (window.authManager.currentUser.is_admin) {
                messageDiv.innerHTML += '<p><a href="/admin/visualize">View data visualization</a></p>';
            }
            messageDiv.style.display = 'block';
            
            // Reset form and show first slide
            showSlide(0);
            document.getElementById('symptom-form').reset();
            
            // Reset tracker
            if (window.interactionTracker) {
                window.interactionTracker.reset();
            }
            
            // Scroll to top to see message
            window.scrollTo(0, 0);
            
        } catch (error) {
            // Show error message
            messageDiv.className = 'message error';
            messageDiv.innerHTML = '<h3>Error</h3><p>There was a problem submitting your report. Please try again later.</p>';
            messageDiv.style.display = 'block';
            console.error('Error:', error);
        }
    }
});