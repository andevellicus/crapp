// Updated visualization.js for structured data approach

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const metricSelect = document.getElementById('metric-select');
    const symptomSelect = document.getElementById('symptom-select');
    const noDataDiv = document.getElementById('no-data');
    const dataContent = document.getElementById('data-content');
    const metricTypeIndicator = document.getElementById('metric-type-indicator');
    const mouseMetricsHelp = document.getElementById('mouse-metrics-help');
    const keyboardMetricsHelp = document.getElementById('keyboard-metrics-help');
    
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('user_id');
    
    // Chart objects
    let correlationChart = null;
    let timelineChart = null;
    
    // Metric definitions for UI only
    const mouseMetrics = [
        { value: 'click_precision', label: 'Click Precision' },
        { value: 'path_efficiency', label: 'Path Efficiency' },
        { value: 'overshoot_rate', label: 'Overshoot Rate' },
        { value: 'average_velocity', label: 'Average Velocity' },
        { value: 'velocity_variability', label: 'Velocity Variability' }
    ];
    
    const keyboardMetrics = [
        { value: 'typing_speed', label: 'Typing Speed' },
        { value: 'average_inter_key_interval', label: 'Inter-Key Interval' },
        { value: 'typing_rhythm_variability', label: 'Typing Rhythm Variability' },
        { value: 'average_key_hold_time', label: 'Key Hold Time' },
        { value: 'key_press_variability', label: 'Key Press Variability' },
        { value: 'correction_rate', label: 'Correction Rate' },
        { value: 'pause_rate', label: 'Pause Rate' }
    ];
    
    // Initialize app
    initCharts();
    loadSymptomQuestions();
    
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
                        }
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
                        }
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
            
            const questions = await response.json();
            
            // Group questions by input type
            const mouseQuestions = questions.filter(q => q.metrics_type === 'mouse' || q.type === 'radio' || q.type === 'dropdown');
            const keyboardQuestions = questions.filter(q => q.metrics_type === 'keyboard' || q.type === 'text');
            
            // Add input types based on question type
            populateSymptomDropdown(mouseQuestions, keyboardQuestions);
            
            // Initialize metrics dropdown
            updateMetricOptions();
            
            // Load initial data
            updateCharts();
        } catch (error) {
            console.error('Error loading symptom questions:', error);
            showNoData(`Failed to load question definitions: ${error.message}`);
        }
    }
    
    // Populate symptom dropdown with questions
    function populateSymptomDropdown(mouseQuestions, keyboardQuestions) {
        // Clear dropdown
        symptomSelect.innerHTML = '';
        
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
    }
    
    // Update metric options based on selected question
    function updateMetricOptions() {
        // Get selected question input type
        const selectedOption = symptomSelect.options[symptomSelect.selectedIndex];
        if (!selectedOption) return;
        
        const inputType = selectedOption.dataset.inputType || 'mouse';
        
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
    
    // Update charts with selected data
    async function updateCharts() {
        const metricKey = metricSelect.value;
        const symptomKey = symptomSelect.value;
        
        if (!metricKey || !symptomKey) return;
        
        try {
            // Determine which user's data to fetch
            const userEmail = userIdParam || window.authManager.getCurrentUser()?.email;
            
            if (!userEmail) {
                showNoData("Not logged in. Please log in to view data.");
                return;
            }
            
            // Show loading state
            dataContent.classList.add('loading');
            
            // Fetch data using the new structured endpoints
            const [correlationData, timelineData] = await Promise.all([
                fetch(`/api/metrics/correlation?user_id=${userEmail}&symptom=${symptomKey}&metric=${metricKey}`, {
                    headers: { 'Authorization': `Bearer ${window.authManager.getCurrentToken()}` }
                }).then(response => {
                    if (!response.ok) throw new Error('Failed to load correlation data');
                    return response.json();
                }),
                
                fetch(`/api/metrics/timeline?user_id=${userEmail}&symptom=${symptomKey}&metric=${metricKey}`, {
                    headers: { 'Authorization': `Bearer ${window.authManager.getCurrentToken()}` }
                }).then(response => {
                    if (!response.ok) throw new Error('Failed to load timeline data');
                    return response.json();
                })
            ]);
            
            // Hide loading state
            dataContent.classList.remove('loading');
            
            // Always show dataContent which includes controls
            dataContent.style.display = 'block';
            
            // Check if we have data
            if ((!correlationData || correlationData.length === 0) && 
                (!timelineData || timelineData.length === 0)) {
                showNoData(`No data available for this symptom and metric combination.`);
                return;
            }
            
            // Hide no data message
            noDataDiv.style.display = 'none';
            
            // Show chart containers
            const chartContainers = document.querySelectorAll('.chart-container');
            chartContainers.forEach(container => {
                container.style.display = 'block';
            });
            
            // Get labels for chart titles
            const symptomLabel = symptomSelect.options[symptomSelect.selectedIndex].textContent;
            const metricLabel = metricSelect.options[metricSelect.selectedIndex].textContent;
            
            // Update charts if data exists
            if (correlationData && correlationData.length > 0) {
                updateCorrelationChart(correlationData, symptomLabel, metricLabel);
            } else {
                // If no correlation data, clear chart
                correlationChart.data.datasets[0].data = [];
                correlationChart.update();
            }
            
            if (timelineData && timelineData.length > 0) {
                updateTimelineChart(timelineData, symptomLabel, metricLabel);
            } else {
                // If no timeline data, clear chart
                timelineChart.data.datasets[0].data = [];
                timelineChart.data.datasets[1].data = [];
                timelineChart.data.labels = [];
                timelineChart.update();
            }
            
        } catch (error) {
            console.error('Error updating charts:', error);
            showNoData(`Failed to load data: ${error.message}`);
        }
    }
    
    // Update correlation chart with data
    function updateCorrelationChart(data, symptomLabel, metricLabel) {
        // Log raw data for debugging
        console.log("Correlation data:", data);
        
        // Format data for the chart - structured format with symptom_value and metric_value
        const chartData = data.map(point => {
            return {
                x: point.metric_value,
                y: point.symptom_value
            };
        });
        
        // Update chart data
        correlationChart.data.datasets[0].data = chartData;
        
        // Update chart options
        correlationChart.options.scales.x.title.text = metricLabel;
        correlationChart.options.scales.y.title.text = `${symptomLabel} Severity`;
        correlationChart.options.plugins.title.text = `Correlation: ${symptomLabel} vs ${metricLabel}`;
        
        // Update scales
        const symptomValues = chartData.map(p => p.y);
        const symptomMin = Math.floor(Math.min(...symptomValues));
        const symptomMax = Math.ceil(Math.max(...symptomValues));
        
        correlationChart.options.scales.y.min = symptomMin;
        correlationChart.options.scales.y.max = symptomMax;
        
        // Force chart update
        correlationChart.update();
    }
    
    // Update timeline chart with data
    function updateTimelineChart(data, symptomLabel, metricLabel) {
        // Log raw data for debugging
        console.log("Timeline data:", data);
        
        // Format dates for x-axis
        const labels = data.map(point => formatDate(point.date));
        
        // Format data for datasets - structured format with symptom_value and metric_value
        const symptomData = data.map(point => point.symptom_value);
        const metricData = data.map(point => point.metric_value);
        
        // Update chart data
        timelineChart.data.labels = labels;
        timelineChart.data.datasets[0].data = symptomData;
        timelineChart.data.datasets[1].data = metricData;
        
        // Update dataset labels
        timelineChart.data.datasets[0].label = symptomLabel;
        timelineChart.data.datasets[1].label = metricLabel;
        
        // Update chart title
        timelineChart.options.plugins.title.text = `Timeline: ${symptomLabel} and ${metricLabel}`;
        
        // Update scales
        const symptomMin = Math.floor(Math.min(...symptomData));
        const symptomMax = Math.ceil(Math.max(...symptomData));
        const metricMin = Math.floor(Math.min(...metricData) * 0.9);
        const metricMax = Math.ceil(Math.max(...metricData) * 1.1);
        
        timelineChart.options.scales.y.min = symptomMin;
        timelineChart.options.scales.y.max = symptomMax;
        timelineChart.options.scales.y1.min = metricMin;
        timelineChart.options.scales.y1.max = metricMax;
        
        // Update chart
        timelineChart.update();
    }
    
    // Show no data message
    function showNoData(message) {
        // Keep the controls visible
        const controlsDiv = document.querySelector('.controls');
        if (controlsDiv) controlsDiv.style.display = 'flex';
        
        // Show the no data message
        noDataDiv.innerHTML = `<h3>No Data Available</h3><p>${message}</p>`;
        noDataDiv.style.display = 'block';
        
        // Hide chart containers but not the entire content
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            container.style.display = 'none';
        });
        
        // Keep the metrics help visible
        const metricsHelp = document.querySelector('.metrics-help');
        if (metricsHelp) metricsHelp.style.display = 'block';
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
    
    // Add event listeners
    metricSelect.addEventListener('change', updateCharts);
    symptomSelect.addEventListener('change', () => {
        updateMetricOptions();
        updateCharts();
    });
});