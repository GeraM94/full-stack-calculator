package main

import (
	"net/http"
	"time"
)

// runHealthCheck is what the container health check executes. The distroless
// image has no shell and no wget, so the binary checks itself. It returns the
// process exit code: 0 when the server on the given port is healthy, else 1.
func runHealthCheck(port string) int {
	client := http.Client{Timeout: 2 * time.Second}
	response, err := client.Get("http://127.0.0.1:" + port + "/health")
	if err != nil {
		return 1
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
