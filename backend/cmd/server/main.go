// Command server runs the calculator API.
//
//	go run ./cmd/server               listens on :8080
//	PORT=9000 go run ./cmd/server     listens on :9000
//	server healthcheck                exits 0 if a running server is healthy
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example/calculator/internal/calculator"
	"example/calculator/internal/httpapi"
)

const (
	defaultPort     = "8080"
	shutdownTimeout = 10 * time.Second
)

func main() {
	port := environmentOrDefault("PORT", defaultPort)
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthCheck(port))
	}

	logger := log.New(os.Stderr, "", log.LstdFlags)
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.NewRouter(calculator.New(), logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErrors := make(chan error, 1)
	go func() {
		logger.Printf("calculator listening on http://localhost:%s", port)
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("server stopped: %v", err)
		}
	case <-ctx.Done():
		logger.Print("shutting down")
		shutdownContext, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			logger.Fatalf("shutdown did not finish: %v", err)
		}
	}
}

func environmentOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
