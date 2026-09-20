package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
)

// maximumBodyBytes caps the request body. A valid request is an operation
// name and at most two numbers, far below this.
const maximumBodyBytes = 4096

func handleCalculate(calculator Calculator, logger *log.Logger) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calculateRequest, err := decodeCalculateRequest(writer, request)
		if err != nil {
			var bodyTooLarge *http.MaxBytesError
			if errors.As(err, &bodyTooLarge) {
				writeError(writer, logger, http.StatusRequestEntityTooLarge, codeRequestTooLarge,
					fmt.Sprintf("request body is larger than %d bytes", maximumBodyBytes))
				return
			}
			// The decoder's own text names Go types and fields, so it stays
			// out of the response.
			writeError(writer, logger, http.StatusBadRequest, codeInvalidJSON,
				`request body must be one JSON object with the fields "operation" and "operands"`)
			return
		}

		result, err := calculator.Compute(calculateRequest.Operation, calculateRequest.Operands)
		if err != nil {
			status, code := statusAndCode(err)
			message := err.Error()
			if status == http.StatusInternalServerError {
				logger.Printf("computing %q: %v", calculateRequest.Operation, err)
				message = internalErrorMessage
			}
			writeError(writer, logger, status, code, message)
			return
		}

		writeJSON(writer, logger, http.StatusOK, CalculateResponse{Result: result})
	})
}

// decodeCalculateRequest accepts exactly one JSON object with known fields and
// nothing after it.
func decodeCalculateRequest(writer http.ResponseWriter, request *http.Request) (CalculateRequest, error) {
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, maximumBodyBytes))
	decoder.DisallowUnknownFields()

	var calculateRequest CalculateRequest
	if err := decoder.Decode(&calculateRequest); err != nil {
		return CalculateRequest{}, err
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		return CalculateRequest{}, errors.New("unexpected data after the JSON object")
	}
	return calculateRequest, nil
}

func handleHealth(logger *log.Logger) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, logger, http.StatusOK, map[string]string{"status": "ok"})
	})
}

func handleMethodNotAllowed(logger *log.Logger, allowedMethod string) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Allow", allowedMethod)
		writeError(writer, logger, http.StatusMethodNotAllowed, codeMethodNotAllowed,
			"method not allowed; use "+allowedMethod)
	})
}

func handleNotFound(logger *log.Logger) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writeError(writer, logger, http.StatusNotFound, codeNotFound, "no such endpoint")
	})
}

func writeJSON(writer http.ResponseWriter, logger *log.Logger, status int, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	if err := json.NewEncoder(writer).Encode(body); err != nil {
		logger.Printf("failed to write response: %v", err)
	}
}

func writeError(writer http.ResponseWriter, logger *log.Logger, status int, code, message string) {
	writeJSON(writer, logger, status, ErrorResponse{Error: ErrorDetail{Code: code, Message: message}})
}
