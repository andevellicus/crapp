package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gorilla/mux"
	"go.uber.org/zap"
)

// APIHandler handles API endpoints
type APIHandler struct {
	repo           *repository.Repository
	questionLoader *utils.QuestionLoader
	log            *zap.SugaredLogger
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(repo *repository.Repository, questionLoader *utils.QuestionLoader, log *zap.SugaredLogger) *APIHandler {
	return &APIHandler{
		repo:           repo,
		questionLoader: questionLoader,
		log:            log.Named("api"),
	}
}

// GetQuestions returns all questions
func (h *APIHandler) GetQuestions(w http.ResponseWriter, r *http.Request) {
	questions := h.questionLoader.GetQuestions()
	respondWithJSON(w, http.StatusOK, questions)
}

// GetSymptomQuestions returns only the symptom questions (radio type)
func (h *APIHandler) GetSymptomQuestions(w http.ResponseWriter, r *http.Request) {
	questions := h.questionLoader.GetRadioQuestions()
	respondWithJSON(w, http.StatusOK, questions)
}

// SubmitAssessment handles assessment submissions
func (h *APIHandler) SubmitAssessment(w http.ResponseWriter, r *http.Request) {
	var submission models.AssessmentSubmission

	// Parse the request body
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&submission); err != nil {
		h.log.Errorw("Error decoding submission", "error", err)
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Log submission
	h.log.Infow("Received assessment submission", "user_id", submission.UserID)

	// Save to database
	assessmentID, err := h.repo.CreateAssessment(&submission)
	if err != nil {
		h.log.Errorw("Error processing submission", "error", err, "user_id", submission.UserID)
		respondWithError(w, http.StatusInternalServerError, "Error processing assessment submission")
		return
	}

	// Return success response
	respondWithJSON(w, http.StatusOK, models.SubmissionResponse{
		Status:       "success",
		AssessmentID: assessmentID,
	})
}

// GetUserAssessments returns assessments for a user
func (h *APIHandler) GetUserAssessments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	// Get query parameters for pagination
	skip := 0
	limit := 100

	if skipParam := r.URL.Query().Get("skip"); skipParam != "" {
		if val, err := strconv.Atoi(skipParam); err == nil && val >= 0 {
			skip = val
		}
	}

	if limitParam := r.URL.Query().Get("limit"); limitParam != "" {
		if val, err := strconv.Atoi(limitParam); err == nil && val > 0 {
			limit = val
		}
	}

	// Get assessments from database
	assessments, err := h.repo.GetAssessmentsByUser(userID, skip, limit)
	if err != nil {
		h.log.Errorw("Error retrieving assessments", "error", err, "user_id", userID)
		respondWithError(w, http.StatusInternalServerError, "Error retrieving assessments")
		return
	}

	respondWithJSON(w, http.StatusOK, assessments)
}

// Helper function to respond with JSON
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Error encoding response"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// Helper function to respond with error
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}
