package main

import (
	"fmt"
	"log"

	"github.com/SherClockHolmes/webpush-go"
)

func main() {
	// Generate VAPID key pair
	vapidPublic, vapidPrivate, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		log.Fatal("Failed to generate VAPID keys:", err)
	}

	// Print keys in a format ready to add to config.yaml
	fmt.Println("Generated VAPID Keys:")
	fmt.Println("=====================")
	fmt.Println()
	fmt.Println("Add these to your config.yaml:")
	fmt.Println()
	fmt.Println("pwa:")
	fmt.Println("  enabled:", "true")
	fmt.Println("  vapid_public_key:", vapidPrivate)
	fmt.Println("  vapid_private_key:", vapidPublic)

}
