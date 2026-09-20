package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

// listenLocally binds a free port of the loopback interface, the way main
// binds one before handing the listener to run.
func listenLocally(t *testing.T) net.Listener {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("cannot listen: %v", err)
	}
	return listener
}

// noKeepAlive is a client that opens a fresh connection per request, so a
// pooled one never blurs what the server is doing.
func noKeepAlive() *http.Client {
	return &http.Client{
		Transport: &http.Transport{DisableKeepAlives: true},
		Timeout:   5 * time.Second,
	}
}

func TestRunServesTheAPIAndShutsDownCleanly(t *testing.T) {
	var logged bytes.Buffer
	listener := listenLocally(t)
	address := "http://" + listener.Addr().String()
	ctx, cancel := context.WithCancel(context.Background())
	client := noKeepAlive()

	finished := make(chan error, 1)
	go func() { finished <- run(ctx, listener, log.New(&logged, "", 0)) }()

	response, err := client.Get(address + "/health")
	if err != nil {
		t.Fatalf("the server did not answer: %v", err)
	}
	body, _ := io.ReadAll(response.Body)
	response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Errorf("GET /health = %d; want 200", response.StatusCode)
	}
	if got := strings.TrimSpace(string(body)); got != `{"status":"ok"}` {
		t.Errorf("body = %s; want the real router, not a stub", got)
	}

	cancel()
	select {
	case err := <-finished:
		if err != nil {
			t.Fatalf("run returned %v; want nil after a clean shutdown", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("run did not return after the context was cancelled")
	}

	// Shutdown closes the listener, so the port stops answering.
	if _, err := client.Get(address + "/health"); err == nil {
		t.Error("the server still answers after the shutdown")
	}

	for _, want := range []string{"listening on http://localhost:", "shutting down"} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("log = %q; want it to contain %q", logged.String(), want)
		}
	}
}

func TestRunReportsAFailureToServe(t *testing.T) {
	listener := listenLocally(t)
	listener.Close() // as if the port had been taken away

	err := run(context.Background(), listener, log.New(io.Discard, "", 0))

	if err == nil {
		t.Fatal("run returned nil; want the error of the server")
	}
	if !strings.Contains(err.Error(), "server stopped") {
		t.Errorf("error = %v; want it to say that the server stopped", err)
	}
	if !errors.Is(err, net.ErrClosed) {
		t.Errorf("error = %v; want it to wrap the error of the listener", err)
	}
}

func TestRunReportsAShutdownThatDoesNotFinish(t *testing.T) {
	original := shutdownTimeout
	shutdownTimeout = 50 * time.Millisecond
	t.Cleanup(func() { shutdownTimeout = original })

	listener := listenLocally(t)
	ctx, cancel := context.WithCancel(context.Background())

	finished := make(chan error, 1)
	go func() { finished <- run(ctx, listener, log.New(io.Discard, "", 0)) }()

	connection, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatalf("cannot connect: %v", err)
	}
	defer connection.Close()

	// Announced body that never arrives, so the handler stays blocked reading
	// it and the connection counts as busy rather than idle.
	request := "POST /api/v1/calculate HTTP/1.1\r\n" +
		"Host: localhost\r\n" +
		"Content-Type: application/json\r\n" +
		"Content-Length: 40\r\n" +
		"Expect: 100-continue\r\n\r\n"
	if _, err := connection.Write([]byte(request)); err != nil {
		t.Fatalf("cannot write the request: %v", err)
	}

	// The 100 Continue arrives only once the handler starts reading the body,
	// which is what makes this test wait for the busy connection instead of
	// racing it.
	if err := connection.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatalf("cannot set the deadline: %v", err)
	}
	buffer := make([]byte, 128)
	read, err := connection.Read(buffer)
	if err != nil || !strings.Contains(string(buffer[:read]), "100 Continue") {
		t.Fatalf("the handler did not start reading the body: %q, %v", buffer[:read], err)
	}

	cancel()
	select {
	case err := <-finished:
		if err == nil || !strings.Contains(err.Error(), "shutdown did not finish") {
			t.Fatalf("run returned %v; want the shutdown to have run out of time", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("run did not return")
	}
}

func TestNewServerHasTimeouts(t *testing.T) {
	server := newServer(log.New(io.Discard, "", 0))

	timeouts := []struct {
		name  string
		value time.Duration
	}{
		{"ReadHeaderTimeout", server.ReadHeaderTimeout},
		{"ReadTimeout", server.ReadTimeout},
		{"WriteTimeout", server.WriteTimeout},
		{"IdleTimeout", server.IdleTimeout},
	}
	for _, timeout := range timeouts {
		if timeout.value <= 0 {
			t.Errorf("%s = %v; want a limit, so one slow client cannot hold a connection forever",
				timeout.name, timeout.value)
		}
	}
	if server.Handler == nil {
		t.Error("the server has no handler")
	}
}
