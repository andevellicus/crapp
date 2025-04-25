// src/components/admin/AdminUserCharts.jsx 
import React from 'react';
// Import the custom hook
import { useAdminChartData } from '../../hooks/useAdminChartData'; // Adjust path if needed

// Import presentational components
import ChartControls from './charts/ChartControls';
import CorrelationChart from './charts/CorrelationChart';
import TimelineChart from './charts/TimelineChart';
import MetricsExplanation from './charts/MetricsExplanation'; 
import LoadingSpinner from '../common/LoadingSpinner'; 
import NoDataMessage from '../common/NoDataMessage'; 

const AdminUserCharts = () => {
    // Get all state and handlers from the custom hook
    const {
        userId,
        isLoading,
        noData,
        errorMessage,
        selectedSymptom,
        selectedMetric,
        availableMetrics,
        questionGroups,
        correlationData,
        timelineData,
        metricsTypeForExplanation,
        shouldShowCorrelationChart,
        handleSymptomChange,
        handleMetricChange,
        allQuestions // Get allQuestions if needed for context display
    } = useAdminChartData();

    // --- Render Logic ---
    return (
        <div>
            <div className="admin-header"> {/* */}
                <h2>User Analytics</h2> {/* */}
                {userId && <p>Viewing data for user: {userId}</p>} {/* */}
            </div>

             {/* Use ChartControls component with props from hook */}
             <ChartControls
                selectedSymptom={selectedSymptom} 
                selectedMetric={selectedMetric} 
                availableMetrics={availableMetrics} 
                questionGroups={questionGroups} 
                onSymptomChange={handleSymptomChange} 
                onMetricChange={handleMetricChange} 
            />

            {/* Context Display Logic (remains similar, uses state from hook) */}
             <div className="context-display"> 
                {selectedSymptom && allQuestions.length > 0 && (() => { 
                    const question = allQuestions.find(q => q.id === selectedSymptom); 
                    if (!question) return null; 
                     // Use metricsTypeForExplanation from hook
                     if (metricsTypeForExplanation === 'keyboard') { // Simplified check
                         return <p>Viewing keyboard metrics over time...</p>; 
                     } else if (['cpt', 'tmt', 'digit_span'].includes(metricsTypeForExplanation)) { 
                         return <p>Viewing cognitive test metrics over time...</p>; //
                     } else { // Default to mouse
                         return ( 
                             <p> 
                                This visualization shows the relationship between reported symptom severity and 
                                <span id="metric-type-indicator"> {metricsTypeForExplanation} metrics</span> while answering... 
                            </p> 
                         ); 
                     } 
                })()} 
            </div> 

            {/* Conditional Rendering based on hook state */}
             {isLoading ? ( 
                <LoadingSpinner message="Loading chart data..." /> 
            ) : noData ? ( 
                 <NoDataMessage message={errorMessage || "No data available for this selection."} /> // Show error message if available
            ) : ( 
                <> 
                     {/* Use shouldShowCorrelationChart from hook */}
                     {shouldShowCorrelationChart && <CorrelationChart data={correlationData} />} 
                     {timelineData && <TimelineChart data={timelineData} />} {/* Render timeline if data exists */} 
                 </> //
            )} 

            {/* Use MetricsExplanation component with props from hook */}
            <MetricsExplanation
                metricsType={metricsTypeForExplanation} // Use derived type from hook
                selectedMetric={selectedMetric} // Pass selected metric
            /> 
        </div>
    );
};

export default AdminUserCharts;