package metrics

import (
	"math"
	"sort"
)

// MetricResult represents a calculated metric with status and metadata
type MetricResult struct {
	Value      float64 `json:"value"`
	Calculated bool    `json:"calculated"`
	SampleSize int     `json:"sampleSize,omitempty"`
}

// InteractionData represents raw client interaction data
type InteractionData struct {
	Movements      []Movement      `json:"movements"`
	Interactions   []Interaction   `json:"interactions"`
	KeyboardEvents []KeyboardEvent `json:"keyboardEvents"`
	StartTime      float64         `json:"startTime"`
}

type Movement struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Timestamp  float64 `json:"timestamp"`
	TargetID   string  `json:"targetId,omitempty"`
	QuestionID string  `json:"questionId,omitempty"`
}

type Interaction struct {
	TargetID   string  `json:"targetId"`
	TargetType string  `json:"targetType"`
	QuestionID string  `json:"questionId,omitempty"`
	ClickX     float64 `json:"clickX"`
	ClickY     float64 `json:"clickY"`
	TargetX    float64 `json:"targetX"`
	TargetY    float64 `json:"targetY"`
	Timestamp  float64 `json:"timestamp"`
}

type KeyboardEvent struct {
	Type       string  `json:"type"`
	Key        string  `json:"key"`
	IsModifier bool    `json:"isModifier"`
	Timestamp  float64 `json:"timestamp"`
	QuestionID string  `json:"questionId,omitempty"`
}

// MetricCalculator calculates interaction metrics from raw data
type MetricCalculator struct {
	Data InteractionData
}

// NewMetricCalculator creates a new metric calculator
func NewMetricCalculator(data InteractionData) *MetricCalculator {
	return &MetricCalculator{
		Data: data,
	}
}

// CalculateAllMetrics calculates all interaction metrics
func (mc *MetricCalculator) CalculateAllMetrics() map[string]interface{} {
	metrics := make(map[string]interface{})

	// Global metrics
	metrics["clickPrecision"] = mc.calculateClickPrecision(nil)
	metrics["pathEfficiency"] = mc.calculatePathEfficiency(nil)
	metrics["overShootRate"] = mc.calculateOvershootRate(nil)
	metrics["averageVelocity"] = mc.calculateAverageVelocity(nil)
	metrics["velocityVariability"] = mc.calculateVelocityVariability(nil)

	// Add keyboard metrics
	keyboardMetrics := mc.calculateKeyboardMetrics(nil)
	for k, v := range keyboardMetrics {
		metrics[k] = v
	}

	// Per-question metrics
	questionMetrics := mc.calculatePerQuestionMetrics()
	metrics["questionMetrics"] = questionMetrics

	return metrics
}

// Calculate per-question metrics
func (mc *MetricCalculator) calculatePerQuestionMetrics() map[string]map[string]interface{} {
	// Get unique question IDs
	questionIDs := make(map[string]bool)

	for _, interaction := range mc.Data.Interactions {
		if interaction.QuestionID != "" {
			questionIDs[interaction.QuestionID] = true
		}
	}

	for _, movement := range mc.Data.Movements {
		if movement.QuestionID != "" {
			questionIDs[movement.QuestionID] = true
		}
	}

	for _, event := range mc.Data.KeyboardEvents {
		if event.QuestionID != "" {
			questionIDs[event.QuestionID] = true
		}
	}

	// Calculate metrics for each question
	result := make(map[string]map[string]interface{})

	for questionID := range questionIDs {
		qMetrics := make(map[string]interface{})
		qID := questionID // Create a copy for pointer safety

		// Mouse metrics
		qMetrics["clickPrecision"] = mc.calculateClickPrecision(&qID)
		qMetrics["pathEfficiency"] = mc.calculatePathEfficiency(&qID)
		qMetrics["overShootRate"] = mc.calculateOvershootRate(&qID)
		qMetrics["averageVelocity"] = mc.calculateAverageVelocity(&qID)
		qMetrics["velocityVariability"] = mc.calculateVelocityVariability(&qID)

		// Keyboard metrics
		keyboardMetrics := mc.calculateKeyboardMetrics(&qID)
		for k, v := range keyboardMetrics {
			qMetrics[k] = v
		}

		result[questionID] = qMetrics
	}

	return result
}

// calculateClickPrecision calculates average normalized click precision with minimal threshold
func (mc *MetricCalculator) calculateClickPrecision(questionID *string) MetricResult {
	// Filter interactions by question if needed
	interactions := mc.filterInteractionsByQuestion(questionID)

	// Check if we have enough data - need at least 1 interaction
	if len(interactions) < 1 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	// Calculate normalized distances
	sum := 0.0
	for _, interaction := range interactions {
		// Calculate distance from center
		distX := interaction.ClickX - interaction.TargetX
		distY := interaction.ClickY - interaction.TargetY
		distance := math.Sqrt(distX*distX + distY*distY)

		// Calculate max possible distance (diagonal of target)
		// This is half the diagonal of the element, assuming it's rectangular
		maxDistance := math.Sqrt(math.Pow(interaction.TargetX, 2)+math.Pow(interaction.TargetY, 2)) / 2
		if maxDistance <= 0 {
			maxDistance = 1 // Prevent division by zero
		}

		// Normalized distance (0-1)
		normalizedDistance := distance / maxDistance
		if normalizedDistance > 1 {
			normalizedDistance = 1
		}

		sum += normalizedDistance
	}

	// Calculate precision (higher is better)
	avgNormalizedDistance := sum / float64(len(interactions))
	precision := 1 - avgNormalizedDistance

	return MetricResult{
		Value:      precision,
		Calculated: true,
		SampleSize: len(interactions),
	}
}

// calculatePathEfficiency calculates mouse path efficiency with minimal threshold
func (mc *MetricCalculator) calculatePathEfficiency(questionID *string) MetricResult {
	movements := mc.filterMovementsByQuestion(questionID)
	interactions := mc.filterInteractionsByQuestion(questionID)

	// Need at least some movements to calculate path
	if len(movements) < 1 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	// Group movements by target/interaction
	targetMovements := make(map[string][]Movement)

	for _, movement := range movements {
		if movement.TargetID != "" {
			targetMovements[movement.TargetID] = append(targetMovements[movement.TargetID], movement)
		}
	}

	// Calculate efficiency for each target
	totalEfficiency := 0.0
	count := 0

	for _, interaction := range interactions {
		targetID := interaction.TargetID
		relevantMovements := targetMovements[targetID]

		// Need at least 2 movements to calculate a path
		if len(relevantMovements) < 2 {
			continue // Not enough movements to calculate path
		}

		// Sort movements by timestamp
		sort.Slice(relevantMovements, func(i, j int) bool {
			return relevantMovements[i].Timestamp < relevantMovements[j].Timestamp
		})

		// Calculate direct distance (first point to click point)
		firstPoint := relevantMovements[0]
		directDistX := interaction.ClickX - firstPoint.X
		directDistY := interaction.ClickY - firstPoint.Y
		directDistance := math.Sqrt(directDistX*directDistX + directDistY*directDistY)

		// Calculate actual path distance
		actualDistance := 0.0
		for i := 1; i < len(relevantMovements); i++ {
			dx := relevantMovements[i].X - relevantMovements[i-1].X
			dy := relevantMovements[i].Y - relevantMovements[i-1].Y
			actualDistance += math.Sqrt(dx*dx + dy*dy)
		}

		// Add final segment to click point
		lastPoint := relevantMovements[len(relevantMovements)-1]
		finalDx := interaction.ClickX - lastPoint.X
		finalDy := interaction.ClickY - lastPoint.Y
		actualDistance += math.Sqrt(finalDx*finalDx + finalDy*finalDy)

		// Calculate efficiency (direct / actual)
		if actualDistance > 0 {
			efficiency := directDistance / actualDistance
			if efficiency > 1 {
				efficiency = 1 // Cap at 100% efficiency
			}
			totalEfficiency += efficiency
			count++
		}
	}

	if count == 0 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	result := totalEfficiency / float64(count)
	return MetricResult{
		Value:      result,
		Calculated: true,
		SampleSize: count,
	}
}

// calculateOvershootRate calculates the rate of target overshooting with minimal threshold
func (mc *MetricCalculator) calculateOvershootRate(questionID *string) MetricResult {
	movements := mc.filterMovementsByQuestion(questionID)
	interactions := mc.filterInteractionsByQuestion(questionID)

	if len(movements) < 1 || len(interactions) < 1 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	// Group movements by target
	targetMovements := make(map[string][]Movement)
	for _, movement := range movements {
		if movement.TargetID != "" {
			targetMovements[movement.TargetID] = append(targetMovements[movement.TargetID], movement)
		}
	}

	// Count overshoots
	overshootCount := 0
	totalTargets := 0

	for _, interaction := range interactions {
		targetID := interaction.TargetID
		relevantMovements := targetMovements[targetID]

		// Need at least 3 movements to detect direction changes
		// This is a minimal threshold for detecting an overshoot pattern
		if len(relevantMovements) < 3 {
			continue
		}

		// Sort movements by timestamp
		sort.Slice(relevantMovements, func(i, j int) bool {
			return relevantMovements[i].Timestamp < relevantMovements[j].Timestamp
		})

		// Detect direction changes toward the end of movement
		directionChanges := 0
		for i := 2; i < len(relevantMovements); i++ {
			prev1 := relevantMovements[i-1]
			prev2 := relevantMovements[i-2]
			curr := relevantMovements[i]

			// Calculate direction vectors
			prevDx := prev1.X - prev2.X
			prevDy := prev1.Y - prev2.Y
			currDx := curr.X - prev1.X
			currDy := curr.Y - prev1.Y

			// Check for sign changes in x or y direction
			if (prevDx*currDx < 0) || (prevDy*currDy < 0) {
				directionChanges++
			}
		}

		// Consider it an overshoot if there are direction changes
		// in the last few movements
		if directionChanges > 0 {
			overshootCount++
		}

		totalTargets++
	}

	if totalTargets == 0 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	result := float64(overshootCount) / float64(totalTargets)
	return MetricResult{
		Value:      result,
		Calculated: true,
		SampleSize: totalTargets,
	}
}

// calculateAverageVelocity calculates average mouse movement velocity with minimal threshold
func (mc *MetricCalculator) calculateAverageVelocity(questionID *string) MetricResult {
	movements := mc.filterMovementsByQuestion(questionID)

	// Need at least 2 movements to calculate velocity (movement between points)
	if len(movements) < 2 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	// Sort movements by timestamp
	sort.Slice(movements, func(i, j int) bool {
		return movements[i].Timestamp < movements[j].Timestamp
	})

	var totalVelocity float64
	var count int

	for i := 1; i < len(movements); i++ {
		dx := movements[i].X - movements[i-1].X
		dy := movements[i].Y - movements[i-1].Y
		dt := (movements[i].Timestamp - movements[i-1].Timestamp) / 1000 // Convert to seconds

		if dt > 0 {
			distance := math.Sqrt(dx*dx + dy*dy)
			velocity := distance / dt
			totalVelocity += velocity
			count++
		}
	}

	if count == 0 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	result := totalVelocity / float64(count)
	return MetricResult{
		Value:      result,
		Calculated: true,
		SampleSize: count,
	}
}

// calculateVelocityVariability calculates consistency of mouse velocity with minimal threshold
func (mc *MetricCalculator) calculateVelocityVariability(questionID *string) MetricResult {
	movements := mc.filterMovementsByQuestion(questionID)

	// Need at least 2 movements to calculate velocity
	if len(movements) < 2 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: 0,
		}
	}

	// Sort movements by timestamp
	sort.Slice(movements, func(i, j int) bool {
		return movements[i].Timestamp < movements[j].Timestamp
	})

	velocities := make([]float64, 0, len(movements)-1)

	for i := 1; i < len(movements); i++ {
		dx := movements[i].X - movements[i-1].X
		dy := movements[i].Y - movements[i-1].Y
		dt := (movements[i].Timestamp - movements[i-1].Timestamp) / 1000 // Convert to seconds

		if dt > 0 {
			distance := math.Sqrt(dx*dx + dy*dy)
			velocity := distance / dt
			velocities = append(velocities, velocity)
		}
	}

	// Need at least 2 velocities to calculate variability
	if len(velocities) < 2 {
		return MetricResult{
			Value:      0.0,
			Calculated: false,
			SampleSize: len(velocities),
		}
	}

	// Calculate average
	var sum float64
	for _, v := range velocities {
		sum += v
	}
	avg := sum / float64(len(velocities))

	// Calculate variance
	var variance float64
	for _, v := range velocities {
		variance += math.Pow(v-avg, 2)
	}
	variance /= float64(len(velocities))

	// Standard deviation / average (coefficient of variation)
	result := math.Sqrt(variance) / avg
	return MetricResult{
		Value:      result,
		Calculated: true,
		SampleSize: len(velocities),
	}
}

// calculateKeyboardMetrics calculates all keyboard-related metrics with minimal thresholds
func (mc *MetricCalculator) calculateKeyboardMetrics(questionID *string) map[string]MetricResult {
	events := mc.filterKeyboardEventsByQuestion(questionID)
	metrics := make(map[string]MetricResult)

	// Initialize with uncalculated values
	metrics["typingSpeed"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: len(events),
	}

	metrics["averageInterKeyInterval"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["typingRhythmVariability"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["averageKeyHoldTime"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["keyPressVariability"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["correctionRate"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["pauseRate"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	// Need at least 1 event to calculate anything
	if len(events) < 1 {
		return metrics
	}

	// Sort events by timestamp
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp < events[j].Timestamp
	})

	// Extract keydown events for typing speed
	keydownEvents := make([]KeyboardEvent, 0)
	for _, event := range events {
		if event.Type == "keydown" {
			keydownEvents = append(keydownEvents, event)
		}
	}

	// Calculate typing speed (keystrokes per second)
	// Need at least 2 keydown events to have a meaningful time interval
	if len(keydownEvents) >= 2 {
		totalTime := (keydownEvents[len(keydownEvents)-1].Timestamp - keydownEvents[0].Timestamp) / 1000 // seconds
		if totalTime > 0 {
			typingSpeed := float64(len(keydownEvents)) / totalTime
			metrics["typingSpeed"] = MetricResult{
				Value:      typingSpeed,
				Calculated: true,
				SampleSize: len(keydownEvents),
			}
		}
	}

	// Calculate inter-key intervals
	intervals := make([]float64, 0)
	for i := 1; i < len(keydownEvents); i++ {
		interval := keydownEvents[i].Timestamp - keydownEvents[i-1].Timestamp
		intervals = append(intervals, interval)
	}

	// Need at least 1 interval to calculate average
	if len(intervals) >= 1 {
		// Average inter-key interval
		var intervalSum float64
		for _, interval := range intervals {
			intervalSum += interval
		}
		avgInterval := intervalSum / float64(len(intervals))

		metrics["averageInterKeyInterval"] = MetricResult{
			Value:      avgInterval,
			Calculated: true,
			SampleSize: len(intervals),
		}

		// Typing rhythm variability (coefficient of variation of intervals)
		// Need at least 2 intervals to calculate variability
		if len(intervals) >= 2 {
			var intervalVariance float64
			for _, interval := range intervals {
				intervalVariance += math.Pow(interval-avgInterval, 2)
			}
			intervalVariance /= float64(len(intervals))
			typingVariability := math.Sqrt(intervalVariance) / avgInterval

			metrics["typingRhythmVariability"] = MetricResult{
				Value:      typingVariability,
				Calculated: true,
				SampleSize: len(intervals),
			}
		}

		// Calculate pause rate (pauses per keystroke)
		// Can calculate even with 1 interval
		pauseThreshold := 1000.0 // 1 second threshold
		pauseCount := 0

		for _, interval := range intervals {
			if interval > pauseThreshold {
				pauseCount++
			}
		}

		metrics["pauseRate"] = MetricResult{
			Value:      float64(pauseCount) / float64(len(intervals)),
			Calculated: true,
			SampleSize: len(intervals),
		}
	}

	// Calculate key hold times
	keyHoldTimes := make([]float64, 0)
	keyDownMap := make(map[string]float64)

	for _, event := range events {
		if event.Type == "keydown" {
			keyDownMap[event.Key] = event.Timestamp
		} else if event.Type == "keyup" {
			if downTime, exists := keyDownMap[event.Key]; exists {
				holdTime := event.Timestamp - downTime
				keyHoldTimes = append(keyHoldTimes, holdTime)
				delete(keyDownMap, event.Key)
			}
		}
	}

	// Need at least 1 key hold to calculate average
	if len(keyHoldTimes) >= 1 {
		// Average key hold time
		var holdTimeSum float64
		for _, holdTime := range keyHoldTimes {
			holdTimeSum += holdTime
		}
		avgHoldTime := holdTimeSum / float64(len(keyHoldTimes))

		metrics["averageKeyHoldTime"] = MetricResult{
			Value:      avgHoldTime,
			Calculated: true,
			SampleSize: len(keyHoldTimes),
		}

		// Key press variability
		// Need at least 2 hold times to calculate variability
		if len(keyHoldTimes) >= 2 {
			var holdTimeVariance float64
			for _, holdTime := range keyHoldTimes {
				holdTimeVariance += math.Pow(holdTime-avgHoldTime, 2)
			}
			holdTimeVariance /= float64(len(keyHoldTimes))
			keyPressVar := math.Sqrt(holdTimeVariance) / avgHoldTime

			metrics["keyPressVariability"] = MetricResult{
				Value:      keyPressVar,
				Calculated: true,
				SampleSize: len(keyHoldTimes),
			}
		}
	}

	// Count error corrections (backspace/delete usage)
	correctionCount := 0
	for _, event := range keydownEvents {
		if event.Key == "Backspace" || event.Key == "Delete" {
			correctionCount++
		}
	}

	// Calculate correction rate (corrections per keystroke)
	charCount := 0
	for _, event := range keydownEvents {
		if len(event.Key) == 1 { // Single character keys
			charCount++
		}
	}

	// Need at least 1 character to calculate correction rate
	if charCount >= 1 {
		metrics["correctionRate"] = MetricResult{
			Value:      float64(correctionCount) / float64(charCount),
			Calculated: true,
			SampleSize: charCount,
		}
	}

	return metrics
}

// Helper methods
func (mc *MetricCalculator) filterInteractionsByQuestion(questionID *string) []Interaction {
	if questionID == nil {
		return mc.Data.Interactions
	}

	filtered := make([]Interaction, 0)
	for _, interaction := range mc.Data.Interactions {
		if interaction.QuestionID == *questionID {
			filtered = append(filtered, interaction)
		}
	}

	return filtered
}

func (mc *MetricCalculator) filterMovementsByQuestion(questionID *string) []Movement {
	if questionID == nil {
		return mc.Data.Movements
	}

	filtered := make([]Movement, 0)
	for _, movement := range mc.Data.Movements {
		if movement.QuestionID == *questionID {
			filtered = append(filtered, movement)
		}
	}

	return filtered
}

func (mc *MetricCalculator) filterKeyboardEventsByQuestion(questionID *string) []KeyboardEvent {
	if questionID == nil {
		return mc.Data.KeyboardEvents
	}

	filtered := make([]KeyboardEvent, 0)
	for _, event := range mc.Data.KeyboardEvents {
		if event.QuestionID == *questionID {
			filtered = append(filtered, event)
		}
	}

	return filtered
}
