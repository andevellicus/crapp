// internal/auth/password_reset.go
package auth

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

// GeneratePasswordResetToken creates a token for password reset
func (s *AuthService) GeneratePasswordResetToken(email string) (string, error) {
	// Check if user exists
	_, err := s.repo.GetUser(email)
	if err != nil {
		return "", fmt.Errorf("user not found: %w", err)
	}

	// Create a reset token (valid for 30 minutes)
	token, err := s.repo.CreatePasswordResetToken(email, 30)
	if err != nil {
		return "", fmt.Errorf("failed to create reset token: %w", err)
	}

	return token.Token, nil
}

// ValidatePasswordResetToken checks if a password reset token is valid
func (s *AuthService) ValidatePasswordResetToken(tokenStr string) (string, error) {
	token, err := s.repo.ValidatePasswordResetToken(tokenStr)
	if err != nil {
		return "", fmt.Errorf("invalid or expired token: %w", err)
	}

	return token.UserEmail, nil
}

// ResetPassword completes the password reset process
func (s *AuthService) ResetPassword(tokenStr string, newPassword string) error {
	// Validate token
	userEmail, err := s.ValidatePasswordResetToken(tokenStr)
	if err != nil {
		return err
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user's password
	if err := s.repo.UpdateUserPassword(userEmail, hashedPassword); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := s.repo.MarkTokenAsUsed(tokenStr); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	return nil
}
