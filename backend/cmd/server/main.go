// Command server runs the calculator API.
//
//	go run ./cmd/server               listens on :8080
//	PORT=9000 go run ./cmd/server     listens on :9000
//	server healthcheck                exits 0 if a running server is healthy
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example/calculator/internal/calculator"
	"example/calculator/internal/httpapi"
)

const defaultPort = "8080"

// shutdownTimeout is how long a graceful shutdown waits for the requests that
// are still in flight. It is a variable so a test can shorten it.
var shutdownTimeout = 10 * time.Second

// main is wiring and nothing else: the process boundary (arguments, the
// environment, signals, exit codes) is here, and the behaviour is in run.
func main() {
	logger := log.New(os.Stderr, "", log.LstdFlags)
	port := environmentOrDefault("PORT", defaultPort)

	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(runHealthCheck(port))
	}

	// Binding here rather than inside run means a port already in use is
	// reported before anything else starts.
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		logger.Fatalf("cannot listen on port %s: %v", port, err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, listener, logger); err != nil {
		logger.Fatal(err)
	}
}

// newServer is the configured server of the API. The timeouts are the point of
// this function: without them one slow client holds a connection forever.
func newServer(logger *log.Logger) *http.Server {
	return &http.Server{
		Handler:           httpapi.NewRouter(calculator.New(), logger),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

// run serves on the listener until ctx is cancelled and then shuts down
// gracefully, closing the listener. It returns nil when the shutdown finished
// within shutdownTimeout.
func run(ctx context.Context, listener net.Listener, logger *log.Logger) error {
	server := newServer(logger)

	serverErrors := make(chan error, 1)
	go func() {
		// The address of a TCP listener always carries a port.
		_, port, _ := net.SplitHostPort(listener.Addr().String())
		logger.Printf("calculator listening on http://localhost:%s", port)
		serverErrors <- server.Serve(listener)
	}()

	select {
	case err := <-serverErrors:
		// Serve only returns http.ErrServerClosed after a Shutdown, and that
		// shutdown is the other branch, so anything arriving here is a failure.
		return fmt.Errorf("server stopped: %w", err)
	case <-ctx.Done():
		logger.Print("shutting down")
		shutdownContext, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			return fmt.Errorf("shutdown did not finish: %w", err)
		}
		return nil
	}
}

func environmentOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
