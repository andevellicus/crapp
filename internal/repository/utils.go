package repository

import (
	"github.com/andevellicus/crapp/internal/models"
)

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
