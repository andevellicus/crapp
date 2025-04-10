// File: internal/handlers/metrics.go
package handlers

import (
	"fmt"
	"net/http"

	"github.com/andevellicus/crapp/internal/repository"
	"github.com/gin-gonic/gin"
)

// ChartData contains preformatted data ready for Chart.js consumption
type ChartData struct {
	Title    string `json:"title"`
	XLabel   string `json:"xLabel"`
	YLabel   string `json:"yLabel"`
	Y2Label  string `json:"y2Label,omitempty"`
	Data     any    `json:"data"`
	Question string `json:"question,omitempty"`
	Metric   string `json:"metric,omitempty"`
}

// GetChartCorrelationData returns preformatted data for Chart.js scatter plot
func (h *GinAPIHandler) GetChartCorrelationData(c *gin.Context) {
	userID := c.Query("user_id")
	symptomKey := c.Query("symptom")
	metricKey := c.Query("metric")

	// Auth checks
	currentUserEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check access permissions
	isAdmin, _ := c.Get("isAdmin")
	if userID != currentUserEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// Get raw data
	data, err := h.repo.Assessments.GetMetricsCorrelation(userID, symptomKey, metricKey)
	if err != nil {
		h.log.Errorw("Error retrieving metrics correlation", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving data"})
		return
	}

	// If no data, return empty structure
	if data == nil {
		data = &[]repository.CorrelationDataPoint{}
	}

	// Get question and metric labels
	questionLabel := h.getQuestionLabel(symptomKey)
	metricLabel := getMetricLabel(metricKey)

	// Format for Chart.js
	chartData := formatCorrelationDataForChart(*data, questionLabel, metricLabel)

	c.JSON(http.StatusOK, chartData)
}

// GetChartTimelineData returns preformatted data for Chart.js line chart
func (h *GinAPIHandler) GetChartTimelineData(c *gin.Context) {
	userID := c.Query("user_id")
	symptomKey := c.Query("symptom")
	metricKey := c.Query("metric")

	// Auth checks
	currentUserEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check access permissions
	isAdmin, _ := c.Get("isAdmin")
	if userID != currentUserEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	questionType := h.getQuestionsType(symptomKey)

	var timelineData []repository.TimelineDataPoint
	var err error
	if questionType == "tmt" {
		// Get Trail Making Test timeline data
		timelineData, err = h.repo.TMTResults.GetTrailTimelineData(userID, metricKey)
	} else if questionType == "cpt" {
		// Get CPT timeline data
		timelineData, err = h.repo.CPTResults.GetCPTTimelineData(userID, metricKey)
	} else {
		// Get regular interaction metrics timeline data
		timelineData, err = h.repo.Assessments.GetMetricsTimeline(userID, symptomKey, metricKey)
	}

	if err != nil {
		h.log.Errorw("Error retrieving metrics timeline", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving data"})
		return
	}

	// If no data, return empty structure
	if len(timelineData) == 0 {
		timelineData = []repository.TimelineDataPoint{}
	}

	// Get question and metric labels
	var questionLabel string
	if questionType == "cpt" {
		// For CPT metrics, use the metric name as the "question"
		questionLabel = "Cognitive Test"
	} else {
		questionLabel = h.getQuestionLabel(symptomKey)
	}
	metricLabel := getMetricLabel(metricKey)

	// Format for Chart.js
	chartData := formatTimelineDataForChart(timelineData, questionLabel, questionType, metricLabel)

	c.JSON(http.StatusOK, chartData)
}

// Helper to get question label from ID
func (h *GinAPIHandler) getQuestionLabel(questionID string) string {
	question := h.questionLoader.GetQuestionByID(questionID)
	if question == nil {
		return questionID
	}
	return question.Title
}

// Helper to get question type from ID
func (h *GinAPIHandler) getQuestionsType(questionID string) string {
	question := h.questionLoader.GetQuestionByID(questionID)
	if question == nil {
		return questionID
	}
	return question.Type
}

// Format correlation data for Chart.js scatter plot
func formatCorrelationDataForChart(data []repository.CorrelationDataPoint, questionLabel, metricLabel string) ChartData {
	// Format data for the chart
	type ScatterPoint struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}

	chartPoints := make([]ScatterPoint, len(data))
	for i, point := range data {
		chartPoints[i] = ScatterPoint{
			X: point.MetricValue,
			Y: point.SymptomValue,
		}
	}

	// Chart.js scatter plot format
	type ScatterDataset struct {
		Label           string         `json:"label"`
		Data            []ScatterPoint `json:"data"`
		BackgroundColor string         `json:"backgroundColor"`
		BorderColor     string         `json:"borderColor"`
	}

	chartData := ChartData{
		Title:    fmt.Sprintf("Correlation: %s vs %s", questionLabel, metricLabel),
		XLabel:   metricLabel,
		YLabel:   fmt.Sprintf("%s Severity", questionLabel),
		Question: questionLabel,
		Metric:   metricLabel,
		Data: map[string]any{
			"datasets": []ScatterDataset{
				{
					Label:           "Symptom vs. Metric",
					Data:            chartPoints,
					BackgroundColor: "rgba(74, 111, 165, 0.7)",
					BorderColor:     "rgba(74, 111, 165, 1)",
				},
			},
		},
	}

	return chartData
}

// Format timeline data for Chart.js line chart
func formatTimelineDataForChart(data []repository.TimelineDataPoint, questionLabel, questionType, metricLabel string) ChartData {
	// Extract and format dates for labels
	labels := make([]string, len(data))
	symptomData := make([]float64, len(data))
	metricData := make([]float64, len(data))

	for i, point := range data {
		// Format date as "Jan 2, 2006"
		labels[i] = point.Date.Format("Jan 2, 2006")
		symptomData[i] = point.SymptomValue
		metricData[i] = point.MetricValue
	}

	// Chart.js line chart format
	type LineDataset struct {
		Label           string    `json:"label"`
		Data            []float64 `json:"data"`
		BorderColor     string    `json:"borderColor"`
		BackgroundColor string    `json:"backgroundColor"`
		YAxisID         string    `json:"yAxisID"`
	}

	chartData := ChartData{
		Title:  fmt.Sprintf("Timeline: %s and %s", questionLabel, metricLabel),
		XLabel: "Date",

		Metric:   metricLabel,
		Question: questionLabel,
	}

	if questionType == "cpt" || questionType == "text" || questionType == "tmt" {
		dataset := map[string]any{
			"labels": labels,
			"datasets": []LineDataset{
				{
					Label:           metricLabel,
					Data:            metricData,
					BorderColor:     "rgba(90, 154, 104, 1)",
					BackgroundColor: "rgba(90, 154, 104, 0.2)",
					YAxisID:         "y",
				},
			},
		}
		chartData.Data = dataset
		chartData.YLabel = metricLabel
		chartData.Y2Label = ""
	} else {
		dataset := map[string]any{
			"labels": labels,
			"datasets": []LineDataset{
				{
					Label:           questionLabel,
					Data:            symptomData,
					BorderColor:     "rgba(74, 111, 165, 1)",
					BackgroundColor: "rgba(74, 111, 165, 0.2)",
					YAxisID:         "y",
				},
				{
					Label:           metricLabel,
					Data:            metricData,
					BorderColor:     "rgba(90, 154, 104, 1)",
					BackgroundColor: "rgba(90, 154, 104, 0.2)",
					YAxisID:         "y1",
				},
			},
		}
		chartData.Data = dataset
		chartData.YLabel = fmt.Sprintf("%s Severity", questionLabel)
		chartData.Y2Label = metricLabel
	}

	return chartData
}

// Helper to get metric label
func getMetricLabel(metricKey string) string {
	metricLabels := map[string]string{
		// Mouse metrics
		"click_precision":      "Click Precision",
		"path_efficiency":      "Path Efficiency",
		"overshoot_rate":       "Overshoot Rate",
		"average_velocity":     "Average Velocity",
		"velocity_variability": "Velocity Variability",
		// Keyboard metrics
		"typing_speed":                  "Typing Speed",
		"average_inter_key_interval":    "Inter-Key Interval",
		"typing_rhythm_variability":     "Typing Rhythm Variability",
		"average_key_hold_time":         "Key Hold Time",
		"key_press_variability":         "Key Press Variability",
		"correction_rate":               "Correction Rate",
		"pause_rate":                    "Pause Rate",
		"immediate_correction_tendency": "Immediate Correction Tendency",
		"deep_thinking_pause_rate":      "Deep Thinking Pause Rate",
		"keyboard_fluency":              "Keyboard Fluency Score",
		// Cognitive performance test metrics
		"reaction_time":         "Reaction Time",
		"detection_rate":        "Detection Rate",
		"omission_error_rate":   "Omission Error Rate",
		"commission_error_rate": "Commission Error Rate",
		// Trail making test metrics
		"part_a_time":   "Part A Time",
		"part_b_time":   "Part B Time",
		"b_to_a_ratio":  "B/A Ratio",
		"part_a_errors": "Part A Errors",
		"part_b_errors": "Part B Errors",
	}

	if label, ok := metricLabels[metricKey]; ok {
		return label
	}
	return metricKey
}
