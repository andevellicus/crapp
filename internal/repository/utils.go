package repository

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/andevellicus/crapp/internal/models"
)

// Helper function to safely navigate nested maps
func getNestedMap(data interface{}, key string) map[string]interface{} {
	if data == nil {
		return nil
	}

	// Try to cast data to map
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		return nil
	}

	// Try to get value at key
	value, ok := dataMap[key]
	if !ok {
		return nil
	}

	// Try to cast value to map
	valueMap, ok := value.(map[string]interface{})
	if !ok {
		return nil
	}

	return valueMap
}

// Helper to extract float64 from different value types
func extractFloat64Value(val interface{}) (*float64, error) {
	switch v := val.(type) {
	case float64:
		return &v, nil
	case int:
		f := float64(v)
		return &f, nil
	case map[string]interface{}:
		// Handle the case where metric value is an object with "value" field (common pattern)
		if value, ok := v["value"].(float64); ok {
			return &value, nil
		}
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return &f, nil
		}
	}
	return nil, fmt.Errorf("couldn't convert value to float64")
}

// Helper function to extract float64 values from JSON
func getFloat64FromJSON(data models.JSON, key string) (*float64, bool) {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return &v, true
		case int:
			f := float64(v)
			return &f, true
		case map[string]interface{}:
			// Check if it's in the format with "value" field
			if valueField, ok := v["value"].(float64); ok {
				return &valueField, true
			}
		}
	}
	return nil, false
}

// Helper function to convert snake_case to camelCase
func toCamelCase(s string) string {
	parts := strings.Split(s, "_")
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}
