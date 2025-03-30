// internal/email/service.go
package email

import (
	"bytes"
	"fmt"
	"html/template"
	"path/filepath"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/go-mail/mail"
	"go.uber.org/zap"
)

// EmailService handles sending emails
type EmailService struct {
	config *config.EmailConfig
	log    *zap.SugaredLogger
}

// NewEmailService creates a new email service
func NewEmailService(cfg *config.EmailConfig, log *zap.SugaredLogger) *EmailService {
	return &EmailService{
		config: cfg,
		log:    log.Named("email"),
	}
}

// SendEmail sends an email with the given parameters
func (s *EmailService) SendEmail(to string, subject string, htmlBody string, textBody string) error {
	m := mail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail))
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", textBody)
	m.AddAlternative("text/html", htmlBody)

	d := mail.NewDialer(s.config.SMTPHost, s.config.SMTPPort, s.config.SMTPUsername, s.config.SMTPPassword)
	d.StartTLSPolicy = mail.MandatoryStartTLS

	if err := d.DialAndSend(m); err != nil {
		s.log.Errorw("Failed to send email", "error", err, "to", to)
		return err
	}

	s.log.Infow("Email sent successfully", "to", to, "subject", subject)
	return nil
}

// SendPasswordResetEmail sends a password reset email
func (s *EmailService) SendPasswordResetEmail(to string, resetToken string) error {
	subject := "Reset Your CRAPP Password"
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", s.config.AppURL, resetToken)

	// Load template
	templatePath := filepath.Join("static", "templates", "emails", "password_reset.html")
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		s.log.Errorw("Failed to parse email template", "error", err)
		return err
	}

	// Prepare data for template
	data := map[string]string{
		"ResetLink": resetLink,
		"AppURL":    s.config.AppURL,
	}

	// Render HTML template
	var htmlBuffer bytes.Buffer
	if err := tmpl.Execute(&htmlBuffer, data); err != nil {
		s.log.Errorw("Failed to execute email template", "error", err)
		return err
	}

	// Create plain text version
	textBody := fmt.Sprintf("Reset your CRAPP password by clicking this link: %s\n\nIf you did not request a password reset, please ignore this email.", resetLink)

	// Send email
	return s.SendEmail(to, subject, htmlBuffer.String(), textBody)
}

// SendWelcomeEmail sends a welcome email after registration
func (s *EmailService) SendWelcomeEmail(to string, firstName string) error {
	subject := "Welcome to CRAPP - Cognitive Reporting Application"

	// Load template
	templatePath := filepath.Join("static", "templates", "emails", "welcome.html")
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		s.log.Errorw("Failed to parse email template", "error", err)
		return err
	}

	// Prepare data for template
	data := map[string]string{
		"FirstName": firstName,
		"AppURL":    s.config.AppURL,
	}

	// Render HTML template
	var htmlBuffer bytes.Buffer
	if err := tmpl.Execute(&htmlBuffer, data); err != nil {
		s.log.Errorw("Failed to execute email template", "error", err)
		return err
	}

	// Create plain text version
	textBody := fmt.Sprintf("Welcome to CRAPP, %s! Thank you for registering. Visit %s to log in and complete your first assessment.",
		firstName, s.config.AppURL)

	// Send email
	return s.SendEmail(to, subject, htmlBuffer.String(), textBody)
}

// SendReminderEmail sends a reminder to complete the daily assessment
func (s *EmailService) SendReminderEmail(to string, firstName string) error {
	subject := "Daily Assessment Reminder - CRAPP"

	// Load template
	templatePath := filepath.Join("static", "templates", "emails", "reminder.html")
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		s.log.Errorw("Failed to parse email template", "error", err)
		return err
	}

	// Prepare data for template
	data := map[string]string{
		"FirstName": firstName,
		"AppURL":    s.config.AppURL,
	}

	// Render HTML template
	var htmlBuffer bytes.Buffer
	if err := tmpl.Execute(&htmlBuffer, data); err != nil {
		s.log.Errorw("Failed to execute email template", "error", err)
		return err
	}

	// Create plain text version
	textBody := fmt.Sprintf("Hi %s, this is a reminder to complete your daily assessment on CRAPP. Visit %s to log in.",
		firstName, s.config.AppURL)

	// Send email
	return s.SendEmail(to, subject, htmlBuffer.String(), textBody)
}
