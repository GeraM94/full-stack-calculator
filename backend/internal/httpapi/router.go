// Package httpapi is the transport layer: it decodes requests, calls the
// calculator, and encodes responses. It holds no arithmetic.
package httpapi

import (
	"log"
	"net/http"
	"time"
)

// Calculator is what this package needs from the domain. It is declared here,
// by the consumer, so handlers can be tested against a fake.
type Calculator interface {
	Compute(operation string, operands []float64) (float64, error)
}

// NewRouter returns the handler for the whole API.
func NewRouter(calculator Calculator, logger *log.Logger) http.Handler {
	router := http.NewServeMux()

	// A pattern with a method wins over the same path without one, so the
	// second line of each pair only sees the wrong methods and answers them
	// with the JSON envelope instead of the router's plain-text 405.
	router.Handle("POST /api/v1/calculate", handleCalculate(calculator, logger))
	router.Handle("/api/v1/calculate", handleMethodNotAllowed(logger, http.MethodPost))
	router.Handle("GET /health", handleHealth(logger))
	router.Handle("/health", handleMethodNotAllowed(logger, http.MethodGet))
	router.Handle("/", handleNotFound(logger))

	return logRequests(logger, recoverPanics(logger, router))
}

func logRequests(logger *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		startTime := time.Now()
		next.ServeHTTP(writer, request)
		logger.Printf("%s %s (%s)", request.Method, request.URL.Path, time.Since(startTime))
	})
}

// recoverPanics turns a panic in a handler into a 500 with the usual envelope,
// so one bad request cannot take the process down or leak a stack trace.
func recoverPanics(logger *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Printf("panic serving %s %s: %v", request.Method, request.URL.Path, recovered)
				writeError(writer, logger, http.StatusInternalServerError, codeInternalError, internalErrorMessage)
			}
		}()
		next.ServeHTTP(writer, request)
	})
}
