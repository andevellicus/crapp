// internal/models/form_state.go
package models

import (
	"time"
)

// FormState represents user's progress in filling out an assessment
type FormState struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	UserEmail       string    `json:"user_email" gorm:"index"`
	CurrentStep     int       `json:"current_step"`
	Answers         JSON      `json:"answers" gorm:"type:text"`
	QuestionOrder   string    `json:"question_order" gorm:"type:text"`
	StartedAt       time.Time `json:"started_at"`
	LastUpdatedAt   time.Time `json:"last_updated_at"`
	Completed       bool      `json:"completed"`
	InteractionData []byte    `json:"interaction_data" gorm:"type:blob"`
	CPTData         []byte    `json:"cpt_data" gorm:"type:blob"`
}
