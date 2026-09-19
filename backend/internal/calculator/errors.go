package calculator

import "errors"

// Sentinel errors. Callers match them with errors.Is; the transport layer is
// the only place that turns them into status codes.
var (
	ErrUnknownOperation    = errors.New("unknown operation")
	ErrInvalidOperandCount = errors.New("invalid operand count")
	ErrDivisionByZero      = errors.New("cannot divide by zero")
	ErrNegativeSquareRoot  = errors.New("cannot take the square root of a negative number")
	ErrNonFiniteResult     = errors.New("result is not a finite number")
)
