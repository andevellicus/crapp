// static/js/visualization.js - Updated to support different metric types by question
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const metricSelect = document.getElementById('metric-select');
    const symptomSelect = document.getElementById('symptom-select');
    const noDataDiv = document.getElementById('no-data');
    const dataContent = document.getElementById('data-content');
    const metricTypeIndicator = document.getElementById('metric-type-indicator');
    const mouseMetricsHelp = document.getElementById('mouse-metrics-help');
    const keyboardMetricsHelp = document.getElementById('keyboard-metrics-help');
    
    // Metric definitions
    const mouseMetrics = [
        { value: 'clickPrecision', label: 'Click Precision' },
        { value: 'pathEfficiency', label: 'Path Efficiency' },
        { value: 'overShootRate', label: 'Overshoot Rate' },
        { value: 'averageVelocity', label: 'Average Velocity' },
        { value: 'velocityVariability', label: 'Velocity Variability' }
    ];
    
    const keyboardMetrics = [
        { value: 'typingSpeed', label: 'Typing Speed' },
        { value: 'averageInterKeyInterval', label: 'Inter-Key Interval' },
        { value: 'typingRhythmVariability', label: 'Typing Rhythm Variability' },
        { value: 'averageKeyHoldTime', label: 'Key Hold Time' },
        { value: 'keyPressVariability', label: 'Key Press Variability' },
        { value: 'correctionRate', label: 'Correction Rate' },
        { value: 'pauseRate', label: 'Pause Rate' }
    ];
    
    // Chart objects
    let correlationChart = null;
    let timelineChart = null;
    
    // Data storage
    let userData = [];
    let symptomQuestions = [];
    
    // Initialize charts
    function initCharts() {
        // Correlation chart
        const correlationCtx = document.getElementById('correlation-chart').getContext('2d');
        correlationChart = new Chart(correlationCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Symptom vs. Metric',
                    backgroundColor: 'rgba(74, 111, 165, 0.7)',
                    borderColor: 'rgba(74, 111, 165, 1)',
                    data: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Correlation: Symptom vs. Interaction Metric'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Interaction Metric'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Symptom Severity'
                        },
                        // Scales will be set dynamically based on question definition
                    }
                }
            }
        });
        
        // Timeline chart
        const timelineCtx = document.getElementById('timeline-chart').getContext('2d');
        timelineChart = new Chart(timelineCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Symptom',
                        backgroundColor: 'rgba(74, 111, 165, 0.2)',
                        borderColor: 'rgba(74, 111, 165, 1)',
                        data: [],
                        yAxisID: 'y'
                    },
                    {
                        label: 'Metric',
                        backgroundColor: 'rgba(90, 154, 104, 0.2)',
                        borderColor: 'rgba(90, 154, 104, 1)',
                        data: [],
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Timeline: Symptom and Interaction Metric'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Symptom Severity'
                        },
                        // Scales will be set dynamically
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Interaction Metric'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }
    
    // Load symptom questions from API
    async function loadSymptomQuestions() {
        try {
            const response = await fetch('/api/questions');
            if (!response.ok) {
                throw new Error('Failed to load questions');
            }
            
            symptomQuestions = await response.json();
            console.log(`Loaded ${symptomQuestions.length} symptom questions`);
            
            // Add input types based on question type
            symptomQuestions.forEach(question => {
                // Determine input type based on question type
                question.inputType = getInputTypeFromQuestion(question);
            });
            
            // Populate symptom dropdown
            populateSymptomDropdown();
            
            // Load user data
            await loadUserData();
        } catch (error) {
            console.error('Error loading symptom questions:', error);
            showNoData(`Failed to load question definitions: ${error.message}`);
        }
    }
    
    // Determine input type (mouse/keyboard) from question type
    function getInputTypeFromQuestion(question) {
        // If metrics_type is defined, use it
        if (question.metrics_type) {
            return question.metrics_type;
        }
        
        // Otherwise infer from question type
        switch (question.type) {
            case 'text': 
                return 'keyboard';
            case 'radio':
            case 'dropdown':
            default:
                return 'mouse';
        }
    }
    
    // Populate symptom dropdown
    function populateSymptomDropdown() {
        // Clear dropdown
        symptomSelect.innerHTML = '';
        
        // Group questions by input type
        const mouseQuestions = symptomQuestions.filter(q => q.inputType === 'mouse');
        const keyboardQuestions = symptomQuestions.filter(q => q.inputType === 'keyboard');
        
        // Add mouse questions group
        if (mouseQuestions.length > 0) {
            const mouseGroup = document.createElement('optgroup');
            mouseGroup.label = 'Mouse Input Questions';
            
            mouseQuestions.forEach(question => {
                const option = document.createElement('option');
                option.value = question.id;
                option.textContent = question.title;
                option.dataset.inputType = 'mouse';
                mouseGroup.appendChild(option);
            });
            
            symptomSelect.appendChild(mouseGroup);
        }
        
        // Add keyboard questions group
        if (keyboardQuestions.length > 0) {
            const keyboardGroup = document.createElement('optgroup');
            keyboardGroup.label = 'Keyboard Input Questions';
            
            keyboardQuestions.forEach(question => {
                const option = document.createElement('option');
                option.value = question.id;
                option.textContent = question.title;
                option.dataset.inputType = 'keyboard';
                keyboardGroup.appendChild(option);
            });
            
            symptomSelect.appendChild(keyboardGroup);
        }
        
        // Update metric options based on selected question
        updateMetricOptions();
    }
    
    // Update metric options based on selected question
    function updateMetricOptions() {
        // Get selected question
        const selectedQuestionId = symptomSelect.value;
        const selectedQuestion = symptomQuestions.find(q => q.id === selectedQuestionId);
        
        if (!selectedQuestion) return;
        
        // Determine input type
        const inputType = selectedQuestion.inputType || 'mouse';
        
        // Clear metric dropdown
        metricSelect.innerHTML = '';
        
        // Add appropriate metrics
        const metrics = inputType === 'keyboard' ? keyboardMetrics : mouseMetrics;
        
        metrics.forEach(metric => {
            const option = document.createElement('option');
            option.value = metric.value;
            option.textContent = metric.label;
            metricSelect.appendChild(option);
        });
        
        // Update UI to show appropriate metric help
        updateMetricTypeDisplay(inputType);
    }
    
    // Update UI to show appropriate metric help
    function updateMetricTypeDisplay(inputType) {
        if (inputType === 'keyboard') {
            metricTypeIndicator.textContent = 'Keyboard metrics';
            mouseMetricsHelp.style.display = 'none';
            keyboardMetricsHelp.style.display = 'block';
        } else {
            metricTypeIndicator.textContent = 'Mouse metrics';
            mouseMetricsHelp.style.display = 'block';
            keyboardMetricsHelp.style.display = 'none';
        }
    }
    
    // Get scale information for a question
    function getQuestionScale(questionId) {
        const question = symptomQuestions.find(q => q.id === questionId);
        if (!question) return { min: 0, max: 3, step: 1 }; // Default scale
        
        // Try to extract scale from question definition
        if (question.scale) {
            return {
                min: question.scale.min ?? 0,
                max: question.scale.max ?? 3,
                step: question.scale.step ?? 1
            };
        }
        
        // If no explicit scale, derive from options
        if (question.options && question.options.length > 0) {
            const values = question.options.map(opt => parseInt(opt.value)).filter(v => !isNaN(v));
            if (values.length > 0) {
                return {
                    min: Math.min(...values),
                    max: Math.max(...values),
                    step: 1
                };
            }
        }
        
        // Fallback to default
        return { min: 0, max: 3, step: 1 };
    }
    
    // Fetch user data from API
    async function loadUserData() {
        try {
            // Use the current user's email from auth manager
            if (!window.authManager.currentUser || !window.authManager.currentUser.email) {
                showNoData("Not logged in. Please log in to view data.");
                return;
            }
            
            const userEmail = window.authManager.currentUser.email;
            
            const response = await fetch(`/api/assessments?user_id=${userEmail}`, {
                headers: {
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                }
            });
            
            if (!response.ok) throw new Error('Network response was not ok');
            
            userData = await response.json();
            console.log("User data loaded:", userData);
            
            if (userData.length === 0) {
                showNoData("No data available. Users need to submit at least one symptom report.");
                return;
            }
            
            // Set up the UI
            noDataDiv.style.display = 'none';
            dataContent.style.display = 'block';
            
            // Update charts
            updateCharts();
        } catch (error) {
            console.error('Error fetching data:', error);
            showNoData(`Failed to load data: ${error.message}`);
        }
    }
    
    // Show no data message
    function showNoData(message) {
        noDataDiv.innerHTML = `<h3>No Data Available</h3><p>${message}</p>`;
        noDataDiv.style.display = 'block';
        dataContent.style.display = 'none';
    }
    
    // Get question metric key from id
    function getMetricKeyById(questionId) {
        const question = symptomQuestions.find(q => q.id === questionId);
        return question ? question.metric_key || questionId : questionId;
    }
    
    // Get question title from id
    function getQuestionTitleById(questionId) {
        const question = symptomQuestions.find(q => q.id === questionId);
        return question ? question.title : formatLabel(questionId);
    }
    
    // Get symptom value for a given assessment
    function getSymptomValue(dataItem, symptomKey) {
        // First try responses object (new format)
        if (dataItem.responses && dataItem.responses[symptomKey] !== undefined) {
            return dataItem.responses[symptomKey];
        }
        
        // Then try legacy format (symptoms object)
        if (dataItem.symptoms && dataItem.symptoms[symptomKey] !== undefined) {
            return dataItem.symptoms[symptomKey];
        }
        
        // Finally check raw_data
        if (dataItem.raw_data?.responses && dataItem.raw_data.responses[symptomKey] !== undefined) {
            return dataItem.raw_data.responses[symptomKey];
        }
        
        return null;
    }
    
    // Get metric value for a symptom's question
    function getQuestionMetric(dataItem, metricKey, symptomKey) {
        // Try to get question metrics from either source
        let questionMetrics = null;
        
        // First try direct question_metrics field
        if (dataItem.question_metrics && dataItem.question_metrics[symptomKey]) {
            questionMetrics = dataItem.question_metrics[symptomKey];
        }
        // Then try raw_data.metadata.question_metrics
        else if (dataItem.raw_data?.metadata?.question_metrics?.[symptomKey]) {
            questionMetrics = dataItem.raw_data.metadata.question_metrics[symptomKey];
        }
        
        // If we found metrics, get the requested one
        if (questionMetrics) {
            // Handle camelCase vs snake_case differences in data structure
            const camelCaseKey = metricKey.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            
            if (questionMetrics[metricKey] !== undefined) {
                return questionMetrics[metricKey];
            } else if (questionMetrics[camelCaseKey] !== undefined) {
                return questionMetrics[camelCaseKey];
            }
        }
        
        // As fallback, use global metrics
        return dataItem.interaction_metrics?.[metricKey] || 
               dataItem.raw_data?.metadata?.interaction_metrics?.[metricKey];
    }
    
    // Update charts with selected data
    function updateCharts() {
        const metricKey = metricSelect.value;
        const symptomKey = symptomSelect.value;
        
        console.log(`Updating charts for metric: ${metricKey}, symptom: ${symptomKey}`);
        
        // Get selected question
        const selectedQuestion = symptomQuestions.find(q => q.id === symptomKey);
        if (!selectedQuestion) {
            console.error(`Selected question not found: ${symptomKey}`);
            return;
        }
        
        // Get scale for the selected question
        const scale = getQuestionScale(symptomKey);
        console.log(`Question scale: min=${scale.min}, max=${scale.max}, step=${scale.step}`);
        
        // Filter data points that have both the symptom and metric
        const validData = userData.filter(item => {
            // Must have symptom data
            const symptomValue = getSymptomValue(item, symptomKey);
            if (symptomValue === null || symptomValue === undefined) {
                return false;
            }
            
            // Get question-specific metric value (with fallback to global)
            const metricValue = getQuestionMetric(item, metricKey, symptomKey);
            return metricValue !== null && metricValue !== undefined;
        });
        
        console.log(`Found ${validData.length} valid data points`);
        
        if (validData.length === 0) {
            showNoData(`No data available for ${getQuestionTitleById(symptomKey)} and ${formatLabel(metricKey)}.`);
            return;
        }
        
        // Update correlation chart
        const correlationData = validData.map(item => ({
            x: getQuestionMetric(item, metricKey, symptomKey),
            y: getSymptomValue(item, symptomKey)
        }));
        
        correlationChart.data.datasets[0].data = correlationData;
        correlationChart.options.scales.x.title.text = formatLabel(metricKey);
        correlationChart.options.scales.y.min = scale.min;
        correlationChart.options.scales.y.max = scale.max;
        correlationChart.options.scales.y.title.text = `${getQuestionTitleById(symptomKey)} (${scale.min}-${scale.max})`;
        correlationChart.options.plugins.title.text = `Correlation: ${getQuestionTitleById(symptomKey)} vs ${formatLabel(metricKey)}`;
        correlationChart.update();
        
        // Update timeline chart
        const timelineData = [...validData].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        timelineChart.data.labels = timelineData.map(item => formatDate(item.date));
        timelineChart.data.datasets[0].data = timelineData.map(item => getSymptomValue(item, symptomKey));
        timelineChart.data.datasets[1].data = timelineData.map(item => getQuestionMetric(item, metricKey, symptomKey));
        timelineChart.data.datasets[0].label = getQuestionTitleById(symptomKey);
        timelineChart.data.datasets[1].label = formatLabel(metricKey);
        timelineChart.options.scales.y.min = scale.min;
        timelineChart.options.scales.y.max = scale.max;
        timelineChart.options.scales.y.title.text = `${getQuestionTitleById(symptomKey)} (${scale.min}-${scale.max})`;
        timelineChart.options.plugins.title.text = `Timeline: ${getQuestionTitleById(symptomKey)} and ${formatLabel(metricKey)}`;
        timelineChart.update();
        
        // Add debug info
        addDebugInfo(validData, symptomKey);
    }
    
    function addDebugInfo(validData, symptomKey) {
        let debugDiv = document.getElementById('debug-panel');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'debug-panel';
            debugDiv.classList.add('debug-panel');
            document.getElementById('data-content').appendChild(debugDiv);
        }
        
        const metricKey = metricSelect.value;
        const scale = getQuestionScale(symptomKey);
        
        let debugContent = `
            <h3>Debug Information</h3>
            <p>Current selection - Symptom: ${getQuestionTitleById(symptomKey)}, Metric: ${formatLabel(metricKey)}</p>
            <p>Scale: min=${scale.min}, max=${scale.max}, step=${scale.step}</p>
            <p>Data points: ${validData.length}</p>
        `;
        
        // Show question-specific metrics data
        if (validData.length > 0) {
            const sampleItem = validData[0];
            let metricsData = null;
            
            // Try to get from either source
            if (sampleItem.question_metrics && sampleItem.question_metrics[symptomKey]) {
                metricsData = sampleItem.question_metrics[symptomKey];
                debugContent += `<p>Found metrics in question_metrics.${symptomKey}</p>`;
            } 
            else if (sampleItem.raw_data?.metadata?.question_metrics?.[symptomKey]) {
                metricsData = sampleItem.raw_data.metadata.question_metrics[symptomKey];
                debugContent += `<p>Found metrics in raw_data.metadata.question_metrics.${symptomKey}</p>`;
            }
            
            if (metricsData) {
                debugContent += `<h4>${getQuestionTitleById(symptomKey)} Question Metrics:</h4>`;
                debugContent += `<pre>${JSON.stringify(metricsData, null, 2)}</pre>`;
            } else {
                debugContent += `<p>No question-specific metrics found for ${getQuestionTitleById(symptomKey)}</p>`;
            }
            
            // Show sample data point for debugging
            debugContent += `<h4>Sample Data Point Structure:</h4>`;
            debugContent += `<pre>${JSON.stringify({
                symptomValue: getSymptomValue(sampleItem, symptomKey),
                metricValue: getQuestionMetric(sampleItem, metricKey, symptomKey)
            }, null, 2)}</pre>`;
        }
        
        debugDiv.innerHTML = debugContent;
    }
    
    // Format label for display
    function formatLabel(key) {
        return key
            .split(/(?=[A-Z])/)  // Split camelCase
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    // Format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    // Initialize and start
    initCharts();
    loadSymptomQuestions();
    
    // Add event listeners
    metricSelect.addEventListener('change', updateCharts);
    symptomSelect.addEventListener('change', () => {
        updateMetricOptions();
        updateCharts();
    });
});