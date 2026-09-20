package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"example/calculator/internal/calculator"
)

func newRouter(backing Calculator) http.Handler {
	return NewRouter(backing, log.New(io.Discard, "", 0))
}

func send(router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(method, path, strings.NewReader(body)))
	return recorder
}

func decodeError(t *testing.T, recorder *httptest.ResponseRecorder) ErrorDetail {
	t.Helper()
	var response ErrorResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("response is not an error envelope: %v; body: %s", err, recorder.Body)
	}
	return response.Error
}

func TestCalculate(t *testing.T) {
	testCases := []struct {
		name     string
		body     string
		wantBody string
	}{
		{"add", `{"operation":"add","operands":[10,3]}`, `{"result":13}`},
		{"subtract", `{"operation":"subtract","operands":[10,3]}`, `{"result":7}`},
		{"multiply", `{"operation":"multiply","operands":[10,3]}`, `{"result":30}`},
		{"divide", `{"operation":"divide","operands":[10,4]}`, `{"result":2.5}`},
		{"power", `{"operation":"power","operands":[2,10]}`, `{"result":1024}`},
		{"squareRoot", `{"operation":"squareRoot","operands":[9]}`, `{"result":3}`},
		{"percentage", `{"operation":"percentage","operands":[200,15]}`, `{"result":30}`},
		{"a result of zero keeps its field", `{"operation":"subtract","operands":[2,2]}`, `{"result":0}`},
		{"surrounding whitespace is fine", " {\"operation\":\"add\",\"operands\":[1,2]} \n", `{"result":3}`},
	}

	router := newRouter(calculator.New())
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := send(router, http.MethodPost, "/api/v1/calculate", testCase.body)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d; want 200; body: %s", recorder.Code, recorder.Body)
			}
			if got := recorder.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
				t.Errorf("Content-Type = %q", got)
			}
			if got := strings.TrimSpace(recorder.Body.String()); got != testCase.wantBody {
				t.Errorf("body = %s; want %s", got, testCase.wantBody)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	testCases := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"division by zero", `{"operation":"divide","operands":[10,0]}`,
			http.StatusUnprocessableEntity, "DIVISION_BY_ZERO"},
		{"negative square root", `{"operation":"squareRoot","operands":[-4]}`,
			http.StatusUnprocessableEntity, "NEGATIVE_SQUARE_ROOT"},
		{"overflow", `{"operation":"multiply","operands":[1e308,10]}`,
			http.StatusUnprocessableEntity, "NON_FINITE_RESULT"},

		{"unknown operation", `{"operation":"modulo","operands":[1,2]}`,
			http.StatusBadRequest, "UNKNOWN_OPERATION"},
		{"missing operation", `{"operands":[1,2]}`,
			http.StatusBadRequest, "UNKNOWN_OPERATION"},
		{"too many operands", `{"operation":"add","operands":[1,2,3]}`,
			http.StatusBadRequest, "INVALID_OPERAND_COUNT"},
		{"missing operands", `{"operation":"add"}`,
			http.StatusBadRequest, "INVALID_OPERAND_COUNT"},

		{"malformed JSON", `{not json`, http.StatusBadRequest, "INVALID_JSON"},
		{"empty body", ``, http.StatusBadRequest, "INVALID_JSON"},
		{"unknown field", `{"operation":"add","operands":[1,2],"extra":true}`,
			http.StatusBadRequest, "INVALID_JSON"},
		{"operand of the wrong type", `{"operation":"add","operands":["1",2]}`,
			http.StatusBadRequest, "INVALID_JSON"},
		{"number outside the float64 range", `{"operation":"add","operands":[1e999,2]}`,
			http.StatusBadRequest, "INVALID_JSON"},
		{"array instead of object", `["add",1,2]`, http.StatusBadRequest, "INVALID_JSON"},
		{"data after the object", `{"operation":"add","operands":[1,2]} {"again":true}`,
			http.StatusBadRequest, "INVALID_JSON"},

		{"oversized body", `{"operation":"` + strings.Repeat("x", maximumBodyBytes) + `"}`,
			http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE"},
	}

	router := newRouter(calculator.New())
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := send(router, http.MethodPost, "/api/v1/calculate", testCase.body)

			if recorder.Code != testCase.wantStatus {
				t.Errorf("status = %d; want %d", recorder.Code, testCase.wantStatus)
			}
			detail := decodeError(t, recorder)
			if detail.Code != testCase.wantCode {
				t.Errorf("code = %q; want %q", detail.Code, testCase.wantCode)
			}
			if detail.Message == "" {
				t.Error("message is empty")
			}
			// Decoder errors name Go types and struct fields; none of that
			// may reach the client.
			if strings.Contains(detail.Message, "json:") || strings.Contains(detail.Message, "CalculateRequest") {
				t.Errorf("message leaks decoder internals: %q", detail.Message)
			}
		})
	}
}

func TestRouting(t *testing.T) {
	testCases := []struct {
		name       string
		method     string
		path       string
		wantStatus int
		wantCode   string
		wantAllow  string
	}{
		{"GET on calculate", http.MethodGet, "/api/v1/calculate",
			http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST"},
		{"DELETE on calculate", http.MethodDelete, "/api/v1/calculate",
			http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST"},
		{"POST on health", http.MethodPost, "/health",
			http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "GET"},
		{"unknown path", http.MethodGet, "/api/v1/unknown",
			http.StatusNotFound, "NOT_FOUND", ""},
		{"root path", http.MethodGet, "/",
			http.StatusNotFound, "NOT_FOUND", ""},
	}

	router := newRouter(calculator.New())
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			recorder := send(router, testCase.method, testCase.path, "")

			if recorder.Code != testCase.wantStatus {
				t.Errorf("status = %d; want %d", recorder.Code, testCase.wantStatus)
			}
			if got := decodeError(t, recorder).Code; got != testCase.wantCode {
				t.Errorf("code = %q; want %q", got, testCase.wantCode)
			}
			if got := recorder.Header().Get("Allow"); got != testCase.wantAllow {
				t.Errorf("Allow = %q; want %q", got, testCase.wantAllow)
			}
		})
	}
}

func TestHealth(t *testing.T) {
	recorder := send(newRouter(calculator.New()), http.MethodGet, "/health", "")

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200", recorder.Code)
	}
	if got := strings.TrimSpace(recorder.Body.String()); got != `{"status":"ok"}` {
		t.Errorf("body = %s", got)
	}
}

// fakeCalculator stands in for the domain. The handlers only know the
// Calculator interface, so nothing else is needed to drive them.
type fakeCalculator struct {
	result     float64
	err        error
	panicValue any

	gotOperation string
	gotOperands  []float64
}

func (fake *fakeCalculator) Compute(operation string, operands []float64) (float64, error) {
	if fake.panicValue != nil {
		panic(fake.panicValue)
	}
	fake.gotOperation, fake.gotOperands = operation, operands
	return fake.result, fake.err
}

func TestCalculateDelegatesToTheCalculator(t *testing.T) {
	fake := &fakeCalculator{result: 42}

	recorder := send(newRouter(fake), http.MethodPost, "/api/v1/calculate",
		`{"operation":"anything","operands":[1,2,3]}`)

	if fake.gotOperation != "anything" || len(fake.gotOperands) != 3 {
		t.Errorf("calculator received (%q, %v)", fake.gotOperation, fake.gotOperands)
	}
	if got := strings.TrimSpace(recorder.Body.String()); got != `{"result":42}` {
		t.Errorf("body = %s; want the result of the calculator", got)
	}
}

func TestUnexpectedErrorIsLoggedAndNotLeaked(t *testing.T) {
	var logged bytes.Buffer
	fake := &fakeCalculator{err: errors.New("secret detail")}
	router := NewRouter(fake, log.New(&logged, "", 0))

	recorder := send(router, http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":[1,2]}`)

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("status = %d; want 500", recorder.Code)
	}
	detail := decodeError(t, recorder)
	if detail.Code != "INTERNAL_ERROR" || detail.Message != "internal error" {
		t.Errorf("error = %+v", detail)
	}
	if strings.Contains(recorder.Body.String(), "secret detail") {
		t.Error("the response leaks the underlying error")
	}
	if !strings.Contains(logged.String(), "secret detail") {
		t.Error("the underlying error was not logged")
	}
}

func TestPanicIsRecovered(t *testing.T) {
	var logged bytes.Buffer
	fake := &fakeCalculator{panicValue: "boom"}
	router := NewRouter(fake, log.New(&logged, "", 0))

	recorder := send(router, http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":[1,2]}`)

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("status = %d; want 500", recorder.Code)
	}
	if got := decodeError(t, recorder).Code; got != "INTERNAL_ERROR" {
		t.Errorf("code = %q", got)
	}
	if !strings.Contains(logged.String(), "boom") {
		t.Error("the panic was not logged")
	}
}

// brokenWriter fails every write, as a connection closed by the client would.
type brokenWriter struct{ header http.Header }

func (writer brokenWriter) Header() http.Header       { return writer.header }
func (writer brokenWriter) WriteHeader(int)           {}
func (writer brokenWriter) Write([]byte) (int, error) { return 0, errors.New("connection closed") }

func TestWriteFailureIsLogged(t *testing.T) {
	var logged bytes.Buffer
	router := NewRouter(calculator.New(), log.New(&logged, "", 0))

	router.ServeHTTP(brokenWriter{header: http.Header{}}, httptest.NewRequest(http.MethodGet, "/health", nil))

	if !strings.Contains(logged.String(), "failed to write response") {
		t.Errorf("log = %q", logged.String())
	}
}
