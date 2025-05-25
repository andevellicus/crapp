// src/components/charts/UserCharts.jsx 
import React from 'react';
// Import the custom hook
import { useChartData } from '../../hooks/useChartData'; // Adjust path if needed
import { useAuth } from '../../context/AuthContext';

// Import presentational components
import ChartControls from './ChartControls';
import CorrelationChart from './CorrelationChart';
import TimelineChart from './TimelineChart';
import MetricsExplanation from './MetricsExplanation'; 
import LoadingSpinner from '../common/LoadingSpinner'; 
import NoDataMessage from '../common/NoDataMessage'; 

const UserCharts = () => {
    const { user } = useAuth(); 

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
    } = useChartData();
    
    const isAdminView = !!userId; // Check if viewing admin data

    // --- Render Logic ---
    return (
        <div>
            <div className="admin-header"> {/* */}
                {/* Dynamic header based on view type */}
                {isAdminView ? (
                    <>
                        <h2>User Analytics</h2>
                        <p>Viewing data for user: {userId}</p>
                    </>
                ) : (
                    <>
                        <h2>My Data Analytics</h2>
                        <p className="section-description">
                            View your cognitive performance data and symptom patterns over time.
                        </p>
                    </>
                )}
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
                         return <p>Viewing {isAdminView ? '' : 'your '}cognitive test metrics over time...</p>;
                     } else { // Default to mouse
                         return ( 
                             <p> 
                                This visualization shows the relationship between {isAdminView ? 'reported' : 'your reported'} symptom severity and 
                                <span id="metric-type-indicator"> {metricsTypeForExplanation} metrics</span> while answering{isAdminView ? '...' : ' questions.'}
                            </p> 
                         ); 
                     } 
                })()} 
            </div> 

            {/* Conditional Rendering based on hook state */}
             {isLoading ? ( 
                <LoadingSpinner message={`Loading ${isAdminView ? 'chart' : 'your chart'} data...`} /> 
            ) : noData ? ( 
                 <NoDataMessage message={
                     errorMessage || 
                     (isAdminView 
                         ? "No data available for this selection." 
                         : "No data available for this selection. Complete more assessments to see patterns."
                     )
                 } />
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

export default UserCharts;