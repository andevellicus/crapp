package metrics

import (
	"math"
	"sort"
)

type KeyboardEvent struct {
	Type       string  `json:"type"`
	Key        string  `json:"key"`
	IsModifier bool    `json:"isModifier"`
	Timestamp  float64 `json:"timestamp"`
	QuestionID string  `json:"questionId,omitempty"`
}

// calculateKeyboardMetrics calculates all keyboard-related metrics with enhanced analysis
func calculateKeyboardMetrics(questionID *string, interactions *InteractionData) map[string]MetricResult {
	events := filterKeyboardEventsByQuestion(questionID, interactions)
	metrics := make(map[string]MetricResult)

	// Initialize with uncalculated values
	metrics["typing_speed"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: len(events),
	}

	metrics["average_inter_key_interval"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["typing_rhythm_variability"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["average_key_hold_time"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["key_press_variability"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["correction_rate"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["immediate_correction_tendency"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["pause_rate"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["deep_thinking_pause_rate"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	metrics["keyboard_fluency"] = MetricResult{
		Value:      0.0,
		Calculated: false,
		SampleSize: 0,
	}

	// Need at least 3 events to calculate meaningful metrics
	if len(events) < 3 {
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

	// Calculate typing speed with improved filtering (actual content typing)
	if len(keydownEvents) >= 5 { // Require more events for reliable measurement
		// Filter out non-character keys for better content typing speed
		contentKeys := 0
		for _, event := range keydownEvents {
			// Count only character keys and spacing (actual content)
			if len(event.Key) == 1 || event.Key == "Space" || event.Key == "Enter" {
				contentKeys++
			}
		}

		totalTime := (keydownEvents[len(keydownEvents)-1].Timestamp - keydownEvents[0].Timestamp) / 1000 // seconds
		if totalTime > 0 && contentKeys > 0 {
			// Characters per second for actual content
			typingSpeed := float64(contentKeys) / totalTime
			metrics["typing_speed"] = MetricResult{
				Value:      typingSpeed,
				Calculated: true,
				SampleSize: contentKeys,
			}
		}
	}

	// Calculate inter-key intervals
	intervals := make([]float64, 0)
	for i := 1; i < len(keydownEvents); i++ {
		interval := keydownEvents[i].Timestamp - keydownEvents[i-1].Timestamp
		intervals = append(intervals, interval)
	}

	// Inter-key interval analysis with outlier handling
	if len(intervals) >= 3 {
		// Remove extreme outliers (e.g., when user pauses to think)
		filteredIntervals := make([]float64, 0, len(intervals))

		// Sort intervals for percentile calculation
		sortedIntervals := make([]float64, len(intervals))
		copy(sortedIntervals, intervals)
		sort.Float64s(sortedIntervals)

		// Find 95th percentile as cutoff for outliers
		p95idx := int(float64(len(sortedIntervals)) * 0.95)
		if p95idx >= len(sortedIntervals) {
			p95idx = len(sortedIntervals) - 1
		}
		maxInterval := sortedIntervals[p95idx] * 1.5 // Allow 50% over the 95th percentile

		// Filter intervals
		for _, interval := range intervals {
			if interval <= maxInterval {
				filteredIntervals = append(filteredIntervals, interval)
			}
		}

		// Only proceed if we have enough filtered intervals
		if len(filteredIntervals) >= 3 {
			var intervalSum float64
			for _, interval := range filteredIntervals {
				intervalSum += interval
			}
			avgInterval := intervalSum / float64(len(filteredIntervals))

			metrics["average_inter_key_interval"] = MetricResult{
				Value:      avgInterval,
				Calculated: true,
				SampleSize: len(filteredIntervals),
			}

			// Improved typing rhythm variability calculation
			var intervalVariance float64
			for _, interval := range filteredIntervals {
				intervalVariance += math.Pow(interval-avgInterval, 2)
			}
			// Use Bessel's correction for sample variance
			intervalVariance /= float64(len(filteredIntervals) - 1)
			typingVariability := math.Sqrt(intervalVariance) / avgInterval

			metrics["typing_rhythm_variability"] = MetricResult{
				Value:      typingVariability,
				Calculated: true,
				SampleSize: len(filteredIntervals),
			}
		}
	}

	// Improved pause detection with dynamic thresholds
	if len(intervals) >= 5 {
		// Calculate a dynamic pause threshold based on typing speed
		var avgInterval float64
		for _, interval := range intervals {
			avgInterval += interval
		}
		avgInterval /= float64(len(intervals))

		// Define pause threshold as 3x the average interval or at least 1000ms
		pauseThreshold := math.Max(avgInterval*3.0, 1000.0)

		// Count pauses
		pauseCount := 0
		longPauseCount := 0 // Very long pauses (thinking)

		for _, interval := range intervals {
			if interval > pauseThreshold {
				pauseCount++

				// Very long pauses (> 5 seconds) may indicate more cognitive processing
				if interval > 5000 {
					longPauseCount++
				}
			}
		}

		metrics["pause_rate"] = MetricResult{
			Value:      float64(pauseCount) / float64(len(intervals)),
			Calculated: true,
			SampleSize: len(intervals),
		}

		// New metric: Deep thinking pause rate
		metrics["deep_thinking_pause_rate"] = MetricResult{
			Value:      float64(longPauseCount) / float64(len(intervals)),
			Calculated: true,
			SampleSize: len(intervals),
		}
	}

	// Improved key hold time analysis with categorization
	keyHoldTimes := make([]float64, 0)
	letterHoldTimes := make([]float64, 0)
	numberHoldTimes := make([]float64, 0)
	specialHoldTimes := make([]float64, 0)
	keyDownMap := make(map[string]float64)

	for _, event := range events {
		if event.Type == "keydown" {
			keyDownMap[event.Key] = event.Timestamp
		} else if event.Type == "keyup" {
			if downTime, exists := keyDownMap[event.Key]; exists {
				holdTime := event.Timestamp - downTime

				// Only consider realistic hold times (20ms to 1000ms)
				if holdTime >= 20 && holdTime <= 1000 {
					keyHoldTimes = append(keyHoldTimes, holdTime)

					// Categorize by key type
					key := event.Key
					if len(key) == 1 {
						if (key >= "a" && key <= "z") || (key >= "A" && key <= "Z") {
							letterHoldTimes = append(letterHoldTimes, holdTime)
						} else if key >= "0" && key <= "9" {
							numberHoldTimes = append(numberHoldTimes, holdTime)
						} else {
							specialHoldTimes = append(specialHoldTimes, holdTime)
						}
					}
				}

				delete(keyDownMap, event.Key)
			}
		}
	}

	// Key hold time analysis with outlier filtering
	if len(keyHoldTimes) >= 5 {
		// Filter outliers using IQR method
		sort.Float64s(keyHoldTimes)
		q1idx := len(keyHoldTimes) / 4
		q3idx := (len(keyHoldTimes) * 3) / 4
		q1 := keyHoldTimes[q1idx]
		q3 := keyHoldTimes[q3idx]
		iqr := q3 - q1

		filteredHoldTimes := make([]float64, 0, len(keyHoldTimes))
		for _, t := range keyHoldTimes {
			if t >= q1-(1.5*iqr) && t <= q3+(1.5*iqr) {
				filteredHoldTimes = append(filteredHoldTimes, t)
			}
		}

		if len(filteredHoldTimes) >= 5 {
			var holdTimeSum float64
			for _, holdTime := range filteredHoldTimes {
				holdTimeSum += holdTime
			}
			avgHoldTime := holdTimeSum / float64(len(filteredHoldTimes))

			metrics["average_key_hold_time"] = MetricResult{
				Value:      avgHoldTime,
				Calculated: true,
				SampleSize: len(filteredHoldTimes),
			}

			// Calculate key press variability with Bessel's correction
			var holdTimeVariance float64
			for _, holdTime := range filteredHoldTimes {
				holdTimeVariance += math.Pow(holdTime-avgHoldTime, 2)
			}
			holdTimeVariance /= float64(len(filteredHoldTimes) - 1)
			keyPressVar := math.Sqrt(holdTimeVariance) / avgHoldTime

			metrics["key_press_variability"] = MetricResult{
				Value:      keyPressVar,
				Calculated: true,
				SampleSize: len(filteredHoldTimes),
			}
		}
	}

	// Improved correction analysis
	if len(keydownEvents) >= 5 {
		correctionCount := 0
		immediateCorrections := 0
		lastCorrection := -1
		charCount := 0

		for i, event := range keydownEvents {
			if event.Key == "Backspace" || event.Key == "Delete" {
				correctionCount++

				// Check if this is an immediate correction (within 3 keypresses)
				if lastCorrection >= 0 && i-lastCorrection <= 3 {
					immediateCorrections++
				}

				lastCorrection = i
			} else if len(event.Key) == 1 || event.Key == "Space" || event.Key == "Enter" {
				// Count character keys
				charCount++
			}
		}

		// Need at least some character input
		if charCount >= 3 {
			metrics["correction_rate"] = MetricResult{
				Value:      float64(correctionCount) / float64(charCount),
				Calculated: true,
				SampleSize: charCount,
			}

			// New metric: Immediate correction tendency
			if correctionCount > 0 {
				metrics["immediate_correction_tendency"] = MetricResult{
					Value:      float64(immediateCorrections) / float64(correctionCount),
					Calculated: true,
					SampleSize: correctionCount,
				}
			}
		}
	}

	// Calculate a composite keyboard fluency score
	if metrics["typing_speed"].Calculated &&
		metrics["average_inter_key_interval"].Calculated &&
		metrics["typing_rhythm_variability"].Calculated {

		// Get normalized values (higher is better)
		typingSpeed := metrics["typing_speed"].Value
		rhythmConsistency := 1.0 / (1.0 + metrics["typing_rhythm_variability"].Value)
		correctionQuality := 1.0

		// If correction metrics are available
		if metrics["correction_rate"].Calculated {
			// Lower correction rate is better, so invert
			correctionQuality = 1.0 / (1.0 + metrics["correction_rate"].Value)
		}

		// Combine into a weighted fluency score (0-100)
		fluencyScore := 100.0 * ((typingSpeed/5.0)*0.4 + // Weight: 40% (normalized to ~5 chars/sec)
			rhythmConsistency*0.4 + // Weight: 40%
			correctionQuality*0.2) // Weight: 20%

		// Cap at 100
		if fluencyScore > 100.0 {
			fluencyScore = 100.0
		}

		metrics["keyboard_fluency"] = MetricResult{
			Value:      fluencyScore,
			Calculated: true,
			SampleSize: metrics["typing_speed"].SampleSize,
		}
	}
	return metrics
}

func filterKeyboardEventsByQuestion(questionID *string, interactions *InteractionData) []KeyboardEvent {
	if questionID == nil {
		return interactions.KeyboardEvents
	}

	filtered := make([]KeyboardEvent, 0)
	for _, event := range interactions.KeyboardEvents {
		if event.QuestionID == *questionID {
			filtered = append(filtered, event)
		}
	}

	return filtered
}
