package httpapi

// CalculateRequest is the body of POST /api/v1/calculate.
type CalculateRequest struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
}

// CalculateResponse is the success body. It is a separate struct from the
// error body rather than one struct with omitempty, because omitempty would
// drop a result of 0.
type CalculateResponse struct {
	Result float64 `json:"result"`
}

// ErrorResponse is the envelope of every error the API returns.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail carries a stable, machine-readable code and a message for people.
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
