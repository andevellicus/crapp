package metrics

// InteractionData represents raw client interaction data
type InteractionData struct {
	MouseMovements    []MouseMovement    `json:"movements"`
	MouseInteractions []MouseInteraction `json:"interactions"`
	KeyboardEvents    []KeyboardEvent    `json:"keyboardEvents"`
	StartTime         float64            `json:"startTime"`
}

// Calculate per-question metrics
func calculatePerQuestionMetrics(interactions *InteractionData) map[string]map[string]MetricResult {
	// Get unique question IDs
	questionIDs := make(map[string]bool)

	for _, interaction := range interactions.MouseInteractions {
		if interaction.QuestionID != "" {
			questionIDs[interaction.QuestionID] = true
		}
	}

	for _, movement := range interactions.MouseMovements {
		if movement.QuestionID != "" {
			questionIDs[movement.QuestionID] = true
		}
	}

	for _, event := range interactions.KeyboardEvents {
		if event.QuestionID != "" {
			questionIDs[event.QuestionID] = true
		}
	}

	// Calculate metrics for each question
	result := make(map[string]map[string]MetricResult)

	for questionID := range questionIDs {
		qMetrics := make(map[string]MetricResult)
		qID := questionID // Create a copy for pointer safety

		// Mouse metrics
		qMetrics["click_precision"] = calculateClickPrecision(&qID, interactions)
		qMetrics["path_efficiency"] = calculatePathEfficiency(&qID, interactions)
		qMetrics["overshoot_rate"] = calculateOvershootRate(&qID, interactions)
		qMetrics["average_velocity"] = calculateAverageVelocity(&qID, interactions)
		qMetrics["velocity_variability"] = calculateVelocityVariability(&qID, interactions)

		// Keyboard metrics
		keyboardMetrics := calculateKeyboardMetrics(&qID, interactions)
		for k, v := range keyboardMetrics {
			qMetrics[k] = v
		}

		result[questionID] = qMetrics
	}

	return result
}

// Helper methods
func filterInteractionsByQuestion(questionID *string, interactions *InteractionData) []MouseInteraction {
	if questionID == nil {
		// Only return mouse movements (for navigation, etc)
		return interactions.MouseInteractions
	}

	filtered := make([]MouseInteraction, 0)
	for _, interaction := range interactions.MouseInteractions {
		if interaction.QuestionID == *questionID {
			filtered = append(filtered, interaction)
		}
	}

	return filtered
}
