// File: internal/handlers/form.go
package handlers

import (
	"math/rand"
	"net/http"

	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type FormHandler struct {
	questionLoader *utils.QuestionLoader
	log            *zap.SugaredLogger
}

func NewFormHandler(questionLoader *utils.QuestionLoader, log *zap.SugaredLogger) *FormHandler {
	return &FormHandler{
		questionLoader: questionLoader,
		log:            log.Named("form"),
	}
}

func (h *FormHandler) ServeForm(c *gin.Context) {
	// Get all questions
	questions := h.questionLoader.GetQuestions()

	// Randomize question order
	randomizedQuestions := make([]utils.Question, len(questions))
	copy(randomizedQuestions, questions)
	rand.Shuffle(len(randomizedQuestions), func(i, j int) {
		randomizedQuestions[i], randomizedQuestions[j] = randomizedQuestions[j], randomizedQuestions[i]
	})

	// Render the template with the questions
	c.HTML(http.StatusOK, "form.html", gin.H{
		"title":     "Daily Symptom Report",
		"questions": randomizedQuestions,
	})
}
