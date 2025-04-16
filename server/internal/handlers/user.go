package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GetCurrentUser returns the current user's information
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user from database
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user information"})
		return
	}

	// Don't return password hash
	user.Password = nil

	c.JSON(http.StatusOK, user)
}

// UpdateUser updates the current user's information
func (h *AuthHandler) UpdateUser(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.UpdateUserRequest)

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get current user
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user for update", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	// Update basic info
	user.FirstName = req.FirstName
	user.LastName = req.LastName

	// If changing password, verify current password
	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is required"})
			return
		}

		// Verify current password
		err = bcrypt.CompareHashAndPassword(user.Password, []byte(req.CurrentPassword))
		if err != nil {
			// This needs to be a bad request
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
			return
		}

		// Hash and set new password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			h.log.Errorw("Error hashing new password", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating password"})
			return
		}

		user.Password = hashedPassword

		// Save updated password
		if err := h.repo.Users.UpdatePassword(user.Email, user.Password); err != nil {
			h.log.Errorw("Error updating user password", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
			return
		}
	}

	// Save updated user name
	if err := h.repo.Users.UpdateUserName(user); err != nil {
		h.log.Errorw("Error updating user name", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
		return
	}

	// Don't return password hash in response
	user.Password = nil

	if err := h.repo.Users.LastLoginNow(user.Email); err != nil {
		h.log.Errorw("Error updating user login time", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// DeleteAccount handles user account deletion
func (h *AuthHandler) DeleteAccount(c *gin.Context) {
	// Get validated request
	req := c.MustGet("validatedRequest").(*validation.DeleteAccountRequest)

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user from database
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user for deletion", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	if user == nil {
		h.log.Errorw("Error retrieving user for deletion -- user is nil!", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword(user.Password, []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Incorrect password"})
		return
	}

	// Get current token ID to revoke all sessions
	tokenID, hasTokenID := c.Get("tokenID")
	if hasTokenID && tokenID != nil {
		h.authService.RevokeAllUserTokens(userEmail.(string))
	}

	// Delete user account
	err = h.repo.Users.Delete(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error deleting user account", "error", err, "userEmail", userEmail)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// Clear auth cookie
	c.SetCookie("auth_token", "", -1, "/", "", true, true)

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}
