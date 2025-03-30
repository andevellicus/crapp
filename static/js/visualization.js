// Updated visualization.js to use pre-formatted data

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
    
    // Metric definitions
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
    
    // Initialize charts with default configuration
    function initCharts() {
        // Correlation chart
        const correlationCtx = document.getElementById('correlation-chart').getContext('2d');
        correlationChart = new Chart(correlationCtx, {
            type: 'scatter',
            data: {
                datasets: []
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
                datasets: []
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
    
    // Update charts with selected data - now using server-side preformatted data
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
            
            // Fetch pre-formatted data from new endpoints
            const [correlationData, timelineData] = await Promise.all([
                window.authManager.fetchWithAuth(`/api/metrics/chart/correlation?user_id=${userEmail}&symptom=${symptomKey}&metric=${metricKey}`)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load correlation data');
                    return response.json();
                }),
                window.authManager.fetchWithAuth(`/api/metrics/chart/timeline?user_id=${userEmail}&symptom=${symptomKey}&metric=${metricKey}`)
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load timeline data');
                    return response.json();
                })
            ]);
            
            // Hide loading state
            dataContent.classList.remove('loading');
            
            // Always show dataContent which includes controls
            dataContent.style.display = 'block';
            
            // Check if we have data
            const hasCorrelationData = correlationData.data && 
                                     correlationData.data.datasets && 
                                     correlationData.data.datasets.length > 0 &&
                                     correlationData.data.datasets[0].data.length > 0;
                                     
            const hasTimelineData = timelineData.data && 
                                  timelineData.data.datasets && 
                                  timelineData.data.datasets.length > 0 &&
                                  timelineData.data.labels.length > 0;
            
            if (!hasCorrelationData && !hasTimelineData) {
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
            
            // Update correlation chart if data exists
            if (hasCorrelationData) {
                updateCorrelationChart(correlationData);
            } else {
                // Clear chart if no data
                correlationChart.data.datasets = [];
                correlationChart.update();
            }
            
            // Update timeline chart if data exists
            if (hasTimelineData) {
                updateTimelineChart(timelineData);
            } else {
                // Clear chart if no data
                timelineChart.data.labels = [];
                timelineChart.data.datasets = [];
                timelineChart.update();
            }
            
        } catch (error) {
            console.error('Error updating charts:', error);
            showNoData(`Failed to load data: ${error.message}`);
        }
    }
    
    // Update correlation chart with pre-formatted data
    function updateCorrelationChart(chartData) {
        try {
            // Set chart data
            correlationChart.data = chartData.data;
            
            // Update chart options
            correlationChart.options.scales.x.title.text = chartData.xLabel;
            correlationChart.options.scales.y.title.text = chartData.yLabel;
            correlationChart.options.plugins.title.text = chartData.title;
            
            // Force chart update
            correlationChart.update();
        } catch (error) {
            console.error("Error updating correlation chart:", error);
            // Fallback to empty chart
            correlationChart.data.datasets = [];
            correlationChart.update();
        }
    }
    
    // Update timeline chart with pre-formatted data
    function updateTimelineChart(chartData) {
        try {
            // Set chart data
            timelineChart.data = chartData.data;
            
            // Update chart options
            timelineChart.options.plugins.title.text = chartData.title;
            timelineChart.options.scales.y.title.text = chartData.yLabel;
            timelineChart.options.scales.y1.title.text = chartData.y2Label;
            
            // Force chart update
            timelineChart.update();
        } catch (error) {
            console.error("Error updating timeline chart:", error);
            // Fallback to empty chart
            timelineChart.data.datasets = [];
            timelineChart.update();
        }

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
    
    // Add event listeners
    metricSelect.addEventListener('change', updateCharts);
    symptomSelect.addEventListener('change', () => {
        updateMetricOptions();
        updateCharts();
    });
});