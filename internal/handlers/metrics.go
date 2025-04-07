// File: internal/handlers/metrics.go
package handlers

import (
	"fmt"
	"net/http"
	"strconv"

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

	// Get raw data
	data, err := h.repo.Assessments.GetMetricsTimeline(userID, symptomKey, metricKey)
	if err != nil {
		h.log.Errorw("Error retrieving metrics timeline", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving data"})
		return
	}

	// If no data, return empty structure
	if data == nil {
		data = []repository.TimelineDataPoint{}
	}

	// Get question and metric labels
	questionLabel := h.getQuestionLabel(symptomKey)
	metricLabel := getMetricLabel(metricKey)

	// Format for Chart.js
	chartData := formatTimelineDataForChart(data, questionLabel, metricLabel)

	c.JSON(http.StatusOK, chartData)
}

// GetCPTMetrics retrieves CPT results for a user
func (h *GinAPIHandler) GetCPTMetrics(c *gin.Context) {
	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user ID from query - admin only feature
	userID := c.Query("user_id")

	// Check access permissions
	isAdmin, _ := c.Get("isAdmin")
	if userID != "" && userID != userEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// If no user ID specified, use current user
	if userID == "" {
		userID = userEmail.(string)
	}

	// Get days parameter (default to 0 for all time)
	lastDays := 0
	if daysParam := c.Query("days"); daysParam != "" {
		if val, err := strconv.Atoi(daysParam); err == nil && val > 0 {
			lastDays = val
		}
	}

	// Get CPT metrics for user
	results, err := h.repo.CPTResults.GetCPTMetrics(userID, lastDays)
	if err != nil {
		h.log.Errorw("Error retrieving CPT results", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve test results"})
		return
	}

	c.JSON(http.StatusOK, results)
}

// Helper to get question label from ID
func (h *GinAPIHandler) getQuestionLabel(questionID string) string {
	question := h.questionLoader.GetQuestionByID(questionID)
	if question == nil {
		return questionID
	}
	return question.Title
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
func formatTimelineDataForChart(data []repository.TimelineDataPoint, questionLabel, metricLabel string) ChartData {
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
		Title:    fmt.Sprintf("Timeline: %s and %s", questionLabel, metricLabel),
		XLabel:   "Date",
		YLabel:   fmt.Sprintf("%s Severity", questionLabel),
		Y2Label:  metricLabel,
		Question: questionLabel,
		Metric:   metricLabel,
		Data: map[string]any{
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
		},
	}

	return chartData
}

// Helper to get metric label
func getMetricLabel(metricKey string) string {
	metricLabels := map[string]string{
		"click_precision":            "Click Precision",
		"path_efficiency":            "Path Efficiency",
		"overshoot_rate":             "Overshoot Rate",
		"average_velocity":           "Average Velocity",
		"velocity_variability":       "Velocity Variability",
		"typing_speed":               "Typing Speed",
		"average_inter_key_interval": "Inter-Key Interval",
		"typing_rhythm_variability":  "Typing Rhythm Variability",
		"average_key_hold_time":      "Key Hold Time",
		"key_press_variability":      "Key Press Variability",
		"correction_rate":            "Correction Rate",
		"pause_rate":                 "Pause Rate",
	}

	if label, ok := metricLabels[metricKey]; ok {
		return label
	}
	return metricKey
}
