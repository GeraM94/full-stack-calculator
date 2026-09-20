package main

import (
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"example/calculator/internal/calculator"
	"example/calculator/internal/httpapi"
)

func portOf(t *testing.T, server *httptest.Server) string {
	t.Helper()
	_, port, err := net.SplitHostPort(server.Listener.Addr().String())
	if err != nil {
		t.Fatalf("cannot read the port of the test server: %v", err)
	}
	return port
}

func TestRunHealthCheck(t *testing.T) {
	t.Run("the real router is healthy", func(t *testing.T) {
		router := httpapi.NewRouter(calculator.New(), log.New(io.Discard, "", 0))
		server := httptest.NewServer(router)
		defer server.Close()

		if got := runHealthCheck(portOf(t, server)); got != 0 {
			t.Errorf("exit code = %d; want 0", got)
		}
	})

	t.Run("a failing server is unhealthy", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
			writer.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		if got := runHealthCheck(portOf(t, server)); got != 1 {
			t.Errorf("exit code = %d; want 1", got)
		}
	})

	t.Run("a closed port is unhealthy", func(t *testing.T) {
		server := httptest.NewServer(http.NotFoundHandler())
		port := portOf(t, server)
		server.Close()

		if got := runHealthCheck(port); got != 1 {
			t.Errorf("exit code = %d; want 1", got)
		}
	})
}

func TestEnvironmentOrDefault(t *testing.T) {
	t.Setenv("CALCULATOR_TEST_PORT", "9000")
	if got := environmentOrDefault("CALCULATOR_TEST_PORT", "8080"); got != "9000" {
		t.Errorf("with the variable set: got %q; want 9000", got)
	}

	t.Setenv("CALCULATOR_TEST_PORT", "")
	if got := environmentOrDefault("CALCULATOR_TEST_PORT", "8080"); got != "8080" {
		t.Errorf("with the variable empty: got %q; want 8080", got)
	}
}
