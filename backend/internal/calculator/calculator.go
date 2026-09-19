// Package calculator is the arithmetic domain: named operations over float64
// operands. It knows nothing about HTTP or JSON.
package calculator

import (
	"fmt"
	"math"
)

// Operation is one entry of the operations table.
type Operation struct {
	// Arity is the exact number of operands the operation takes.
	Arity int
	// Apply computes the result. Compute has already checked the operand
	// count, so Apply may index operands up to Arity.
	Apply func(operands []float64) (float64, error)
}

// Calculator evaluates operations by name.
type Calculator struct {
	operations map[string]Operation
}

// New returns a Calculator with the standard operations table.
func New() *Calculator {
	return &Calculator{operations: standardOperations()}
}

// standardOperations is the operations table. Supporting a new operation means
// adding one entry here; Compute does not change.
func standardOperations() map[string]Operation {
	return map[string]Operation{
		"add":        {Arity: 2, Apply: add},
		"subtract":   {Arity: 2, Apply: subtract},
		"multiply":   {Arity: 2, Apply: multiply},
		"divide":     {Arity: 2, Apply: divide},
		"power":      {Arity: 2, Apply: power},
		"squareRoot": {Arity: 1, Apply: squareRoot},
		"percentage": {Arity: 2, Apply: percentage},
	}
}

// Compute applies the named operation to the operands. The error, if any,
// wraps one of the sentinels in errors.go, and the result is then 0.
func (calculator *Calculator) Compute(operation string, operands []float64) (float64, error) {
	entry, known := calculator.operations[operation]
	if !known {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, operation)
	}
	if len(operands) != entry.Arity {
		return 0, fmt.Errorf("%w: %q takes %d, got %d",
			ErrInvalidOperandCount, operation, entry.Arity, len(operands))
	}

	result, err := entry.Apply(operands)
	if err != nil {
		return 0, err
	}
	// Overflow and undefined powers surface as an infinity or NaN, which JSON
	// cannot represent; they become an error here instead of reaching an encoder.
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNonFiniteResult
	}
	return result, nil
}

func add(operands []float64) (float64, error) {
	return operands[0] + operands[1], nil
}

func subtract(operands []float64) (float64, error) {
	return operands[0] - operands[1], nil
}

func multiply(operands []float64) (float64, error) {
	return operands[0] * operands[1], nil
}

func divide(operands []float64) (float64, error) {
	if operands[1] == 0 {
		return 0, ErrDivisionByZero
	}
	return operands[0] / operands[1], nil
}

// power raises operands[0] to the exponent operands[1].
func power(operands []float64) (float64, error) {
	return math.Pow(operands[0], operands[1]), nil
}

func squareRoot(operands []float64) (float64, error) {
	if operands[0] < 0 {
		return 0, ErrNegativeSquareRoot
	}
	return math.Sqrt(operands[0]), nil
}

// percentage returns operands[1] percent of operands[0]: percentage(200, 15)
// is 30. Multiplying before dividing keeps whole-number cases exact.
func percentage(operands []float64) (float64, error) {
	return operands[0] * operands[1] / 100, nil
}
