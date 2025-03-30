// internal/handlers/password_reset.go
package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/email"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
)

// ForgotPassword handles password reset requests
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req validation.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Generate reset token
	token, err := h.authService.GeneratePasswordResetToken(req.Email)
	if err != nil {
		// Don't expose whether the email exists or not for security
		h.log.Warnw("Failed to generate reset token", "error", err, "email", req.Email)
		c.JSON(http.StatusOK, gin.H{"message": "If your email is registered, you will receive a password reset link"})
		return
	}

	// Send email
	emailService, exists := c.Get("emailService")
	if !exists || emailService == nil {
		h.log.Errorw("Email service not available", "email", req.Email)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Email service not available"})
		return
	}

	if err := emailService.(*email.EmailService).SendPasswordResetEmail(req.Email, token); err != nil {
		h.log.Errorw("Failed to send password reset email", "error", err, "email", req.Email)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reset email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset link has been sent to your email"})
}

// ValidateResetToken validates a password reset token
func (h *AuthHandler) ValidateResetToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	// Validate token
	email, err := h.authService.ValidatePasswordResetToken(token)
	if err != nil {
		h.log.Warnw("Invalid reset token", "error", err, "token", token)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": true, "email": email})
}

// ResetPassword handles password reset submissions
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req validation.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Reset password
	err := h.authService.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		h.log.Errorw("Failed to reset password", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password has been reset successfully"})
}
