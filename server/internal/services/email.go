// internal/email/service.go
package services

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"strings"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/go-mail/mail"
	"github.com/vanng822/go-premailer/premailer"
	"go.uber.org/zap"
)

// EmailService handles sending emails
type EmailService struct {
	config    *config.EmailConfig
	log       *zap.SugaredLogger
	templates map[string]*template.Template
}

// NewEmailService creates a new email service
func NewEmailService(cfg *config.EmailConfig, log *zap.SugaredLogger) *EmailService {
	service := &EmailService{
		config:    cfg,
		log:       log.Named("email"),
		templates: make(map[string]*template.Template),
	}

	// Load all email templates with CSS already inlined
	service.loadEmailTemplates()

	return service
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

	// Prepare data for template
	data := map[string]string{
		"ResetLink": resetLink,
		"AppURL":    s.config.AppURL,
	}

	textBody := fmt.Sprintf("Reset your CRAPP password by clicking this link: %s\n\nIf you did not request a password reset, please ignore this email.", resetLink)
	// Render HTML template using the stored template with CSS inlined
	htmlBody, err := s.renderTemplate("password_reset", data)
	if err != nil {
		s.log.Errorw("Failed to render password reset template", "error", err)
		htmlBody = fmt.Sprintf("<html><body><h1>Welcome to CRAPP</h1><p>%s</p></body></html>", textBody)
	}
	return s.SendEmail(to, subject, htmlBody, textBody)
}

// SendWelcomeEmail sends a welcome email after registration
func (s *EmailService) SendWelcomeEmail(to string, firstName string) error {
	subject := "Welcome to CRAPP - Cognitive Reporting Application"

	// Prepare data for template
	data := map[string]string{
		"FirstName": firstName,
		"AppURL":    s.config.AppURL,
	}

	textBody := fmt.Sprintf("Welcome to CRAPP, %s! Thank you for registering. Visit %s to log in and complete your first assessment.",
		firstName, s.config.AppURL)
	// Render HTML template with CSS inlined
	htmlBody, err := s.renderTemplate("welcome", data)
	if err != nil {
		s.log.Errorw("Failed to render welcome email", "error", err)
		htmlBody = fmt.Sprintf("<html><body><h1>Welcome to CRAPP</h1><p>%s</p></body></html>", textBody)
	}
	return s.SendEmail(to, subject, htmlBody, textBody)
}

// SendReminderEmail sends a reminder to complete the daily assessment
func (s *EmailService) SendReminderEmail(to string, firstName string) error {
	subject := "Daily Assessment Reminder - CRAPP"

	// Prepare data for template
	data := map[string]string{
		"FirstName": firstName,
		"AppURL":    s.config.AppURL,
	}

	textBody := fmt.Sprintf("Hi %s, this is a reminder to complete your daily assessment on CRAPP. Visit %s to log in.",
		firstName, s.config.AppURL)
	// Render HTML template with CSS inlined
	htmlBody, err := s.renderTemplate("reminder", data)
	if err != nil {
		s.log.Errorw("Failed to render reminder email", "error", err)
		htmlBody = fmt.Sprintf("<html><body><h1>CRAPP Daily Reminder</h1><p>%s</p></body></html>", textBody)
	}
	return s.SendEmail(to, subject, htmlBody, textBody)
}

// inlineCSS applies CSS rules directly to HTML elements using Premailer
func (s *EmailService) inlineCSS(htmlContent, cssContent string) string {
	// First, inject the CSS if it's not already there
	if !strings.Contains(htmlContent, "<style>") && cssContent != "" {
		// Insert CSS in the head section
		htmlContent = strings.Replace(
			htmlContent,
			"</head>",
			"<style>"+cssContent+"</style></head>",
			1,
		)
	}

	// Create premailer options
	options := premailer.NewOptions()
	options.RemoveClasses = false    // Keep classes for clients that support them
	options.CssToAttributes = true   // Convert CSS to HTML attributes where possible
	options.KeepBangImportant = true // Keep !important

	// Create a new premailer instance
	prem, err := premailer.NewPremailerFromString(htmlContent, options)
	if err != nil {
		s.log.Errorw("Failed to create premailer", "error", err)
		return htmlContent // Return original if there's an error
	}

	// Transform the HTML with CSS inlined
	inlined, err := prem.Transform()
	if err != nil {
		s.log.Errorw("Failed to inline CSS", "error", err)
		return htmlContent // Return original if there's an error
	}

	return inlined
}

func (s *EmailService) loadEmailTemplates() {
	templateDir := filepath.Join("client", "public", "templates", "emails")

	// Check if the directory exists
	if _, err := os.Stat(templateDir); os.IsNotExist(err) {
		s.log.Warnw("Email templates directory does not exist", "path", templateDir)
		return
	}

	// Process each HTML template in the directory
	files, err := os.ReadDir(templateDir)
	if err != nil {
		s.log.Errorw("Failed to read email templates directory", "error", err)
		return
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".html") {
			templatePath := filepath.Join(templateDir, file.Name())
			templateName := strings.TrimSuffix(file.Name(), ".html")

			// Read the template file
			templateContent, err := os.ReadFile(templatePath)
			if err != nil {
				s.log.Errorw("Failed to read email template", "template", templateName, "error", err)
				continue
			}

			// Parse the template - we'll inline CSS after executing the template
			tmpl, err := template.New(templateName).Parse(string(templateContent))
			if err != nil {
				s.log.Errorw("Failed to parse email template", "template", templateName, "error", err)
				continue
			}

			// Store the template
			s.templates[templateName] = tmpl
			s.log.Infow("Loaded email template", "template", templateName)
		}
	}
}

// renderTemplate renders an email template with the provided data
func (s *EmailService) renderTemplate(templateName string, data interface{}) (string, error) {
	tmpl, exists := s.templates[templateName]
	if !exists {
		return "", fmt.Errorf("template %s not found", templateName)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	// Load CSS file for inlining
	cssFile := filepath.Join("client", "src", "styles", "email", "email.css")
	cssContent, err := os.ReadFile(cssFile)
	if err != nil {
		s.log.Warnw("Failed to read email CSS file", "error", err)
		// Return un-inlined HTML if we can't load CSS
		return buf.String(), nil
	}

	// Inline CSS using Premailer
	return s.inlineCSS(buf.String(), string(cssContent)), nil
}
