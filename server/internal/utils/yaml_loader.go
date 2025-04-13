package utils

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// QuestionOption represents a possible answer to a question
type QuestionOption struct {
	Value       any    `yaml:"value" json:"value"`
	Label       string `yaml:"label" json:"label"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
}

// Question represents a question definition from YAML
type Question struct {
	ID             string           `yaml:"id" json:"id"`
	Title          string           `yaml:"title" json:"title"`
	Description    string           `yaml:"description,omitempty" json:"description,omitempty"`
	MetricKey      string           `yaml:"metric_key,omitempty" json:"metric_key,omitempty"`
	Type           string           `yaml:"type" json:"type"`
	MetricsType    string           `yaml:"metrics_type,omitempty" json:"metrics_type,omitempty"`
	Required       bool             `yaml:"required" json:"required"`
	Placeholder    string           `yaml:"placeholder,omitempty" json:"placeholder,omitempty"`
	MaxLength      int              `yaml:"max_length,omitempty" json:"max_length,omitempty"`
	Pattern        string           `yaml:"pattern,omitempty" json:"pattern,omitempty"`
	PatternMessage string           `yaml:"pattern_message,omitempty" json:"pattern_message,omitempty"`
	Scale          *Scale           `yaml:"scale,omitempty" json:"scale,omitempty"`
	Options        []QuestionOption `yaml:"options,omitempty" json:"options,omitempty"`
	Default        string           `yaml:"default_option,omitempty" json:"default_option,omitempty"`
}

// Scale represents a numeric scale for a question
type Scale struct {
	Min  int `yaml:"min" json:"min"`
	Max  int `yaml:"max" json:"max"`
	Step int `yaml:"step" json:"step"`
}

// Reminder represents reminder settings
type Reminder struct {
	Frequency  string   `yaml:"frequency" json:"frequency"`
	Times      []string `yaml:"times" json:"times"`
	CutoffTime string   `yaml:"cutoff_time" json:"cutoff_time"`
}

// QuestionsConfig represents the entire questions YAML file
type QuestionsConfig struct {
	Questions []Question `yaml:"questions" json:"questions"`
}

// QuestionLoader loads and processes question definitions
type QuestionLoader struct {
	YAMLPath string
	Config   QuestionsConfig
}

// NewQuestionLoader creates a new question loader
func NewQuestionLoader(yamlPath string) (*QuestionLoader, error) {
	loader := &QuestionLoader{
		YAMLPath: yamlPath,
	}

	err := loader.LoadYAML()
	if err != nil {
		return nil, err
	}

	// Update any missing metrics_type based on question type
	for i := range loader.Config.Questions {
		if loader.Config.Questions[i].MetricsType == "" {
			if loader.Config.Questions[i].Type == "text" {
				loader.Config.Questions[i].MetricsType = "keyboard"
			} else if loader.Config.Questions[i].Type == "cpt" {
				loader.Config.Questions[i].MetricsType = "cpt"
			} else if loader.Config.Questions[i].Type == "trail" {
				loader.Config.Questions[i].MetricsType = "trail"
			} else {
				loader.Config.Questions[i].MetricsType = "mouse"
			}
		}
	}

	return loader, nil
}

// LoadYAML loads the YAML file
func (q *QuestionLoader) LoadYAML() error {
	yamlFile, err := os.ReadFile(q.YAMLPath)
	if err != nil {
		return fmt.Errorf("failed to read questions YAML file: %w", err)
	}

	err = yaml.Unmarshal(yamlFile, &q.Config)
	if err != nil {
		return fmt.Errorf("failed to parse questions YAML file: %w", err)
	}

	if len(q.Config.Questions) == 0 {
		return fmt.Errorf("no questions defined in YAML file")
	}

	return nil
}

// GetQuestions returns all questions
func (q *QuestionLoader) GetQuestions() []Question {
	return q.Config.Questions
}

// GetQuestionByID gets a question by its ID
func (q *QuestionLoader) GetQuestionByID(id string) *Question {
	if id == "" {
		return nil
	}

	for _, question := range q.Config.Questions {
		if question.ID == id {
			return &question
		}
	}
	return nil
}

// GetRadioQuestions gets all radio type questions
func (q *QuestionLoader) GetRadioQuestions() []Question {
	var radioQuestions []Question
	for _, question := range q.Config.Questions {
		if question.Type == "radio" {
			radioQuestions = append(radioQuestions, question)
		}
	}
	return radioQuestions
}

// GetTextQuestions gets all text type questions
func (q *QuestionLoader) GetTextQuestions() []Question {
	var textQuestions []Question
	for _, question := range q.Config.Questions {
		if question.Type == "text" {
			textQuestions = append(textQuestions, question)
		}
	}
	return textQuestions
}

// GetQuestionsByMetricsType gets questions by metrics type
func (q *QuestionLoader) GetQuestionsByMetricsType(metricsType string) []Question {
	var filteredQuestions []Question
	for _, question := range q.Config.Questions {
		if question.MetricsType == metricsType {
			filteredQuestions = append(filteredQuestions, question)
		}
	}
	return filteredQuestions
}
