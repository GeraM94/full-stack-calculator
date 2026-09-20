package httpapi

import (
	"errors"
	"net/http"

	"example/calculator/internal/calculator"
)

// Error codes of the API. Clients branch on these, never on the message.
const (
	codeInvalidJSON         = "INVALID_JSON"
	codeRequestTooLarge     = "REQUEST_TOO_LARGE"
	codeUnknownOperation    = "UNKNOWN_OPERATION"
	codeInvalidOperandCount = "INVALID_OPERAND_COUNT"
	codeDivisionByZero      = "DIVISION_BY_ZERO"
	codeNegativeSquareRoot  = "NEGATIVE_SQUARE_ROOT"
	codeNonFiniteResult     = "NON_FINITE_RESULT"
	codeMethodNotAllowed    = "METHOD_NOT_ALLOWED"
	codeNotFound            = "NOT_FOUND"
	codeInternalError       = "INTERNAL_ERROR"
)

const internalErrorMessage = "internal error"

// domainErrors is the only place where a calculator error meets HTTP. A
// malformed request is 400; a well-formed request that has no answer is 422.
var domainErrors = []struct {
	sentinel error
	status   int
	code     string
}{
	{calculator.ErrUnknownOperation, http.StatusBadRequest, codeUnknownOperation},
	{calculator.ErrInvalidOperandCount, http.StatusBadRequest, codeInvalidOperandCount},
	{calculator.ErrDivisionByZero, http.StatusUnprocessableEntity, codeDivisionByZero},
	{calculator.ErrNegativeSquareRoot, http.StatusUnprocessableEntity, codeNegativeSquareRoot},
	{calculator.ErrNonFiniteResult, http.StatusUnprocessableEntity, codeNonFiniteResult},
}

// statusAndCode maps an error from the calculator to a status and a code.
// Anything it does not recognize is an internal error.
func statusAndCode(err error) (int, string) {
	for _, domainError := range domainErrors {
		if errors.Is(err, domainError.sentinel) {
			return domainError.status, domainError.code
		}
	}
	return http.StatusInternalServerError, codeInternalError
}
