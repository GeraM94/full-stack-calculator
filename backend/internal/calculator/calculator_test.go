package calculator

import (
	"errors"
	"testing"
)

func TestCompute(t *testing.T) {
	testCases := []struct {
		name      string
		operation string
		operands  []float64
		want      float64
	}{
		{"addition", "add", []float64{10, 3}, 13},
		{"subtraction", "subtract", []float64{10, 3}, 7},
		{"multiplication", "multiply", []float64{10, 3}, 30},
		{"division", "divide", []float64{10, 4}, 2.5},
		{"negative operands", "add", []float64{-5, -5}, -10},
		{"zero result", "subtract", []float64{2, 2}, 0},
		{"zero divided by a number", "divide", []float64{0, 5}, 0},

		{"power", "power", []float64{2, 10}, 1024},
		{"power with a zero exponent", "power", []float64{5, 0}, 1},
		{"power with a negative exponent", "power", []float64{2, -2}, 0.25},

		{"square root", "squareRoot", []float64{9}, 3},
		{"square root of zero", "squareRoot", []float64{0}, 0},

		// percentage(value, percent) means "percent percent of value".
		{"percentage", "percentage", []float64{200, 15}, 30},
		{"percentage above one hundred", "percentage", []float64{50, 200}, 100},
		{"percentage of a negative value", "percentage", []float64{-80, 25}, -20},
		{"zero percent", "percentage", []float64{80, 0}, 0},

		// float64 semantics are passed through, not rounded: this is the exact
		// IEEE 754 sum, and formatting it is the caller's concern.
		{"float precision is not hidden", "add", []float64{0.1, 0.2}, 0.30000000000000004},
	}

	calculator := New()
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := calculator.Compute(testCase.operation, testCase.operands)
			if err != nil {
				t.Fatalf("Compute(%q, %v) returned an unexpected error: %v",
					testCase.operation, testCase.operands, err)
			}
			if got != testCase.want {
				t.Errorf("Compute(%q, %v) = %v; want %v",
					testCase.operation, testCase.operands, got, testCase.want)
			}
		})
	}
}

func TestComputeErrors(t *testing.T) {
	testCases := []struct {
		name        string
		operation   string
		operands    []float64
		want        error
		wantMessage string
	}{
		{"division by zero", "divide", []float64{10, 0},
			ErrDivisionByZero, "cannot divide by zero"},
		{"zero divided by zero", "divide", []float64{0, 0},
			ErrDivisionByZero, "cannot divide by zero"},
		{"square root of a negative number", "squareRoot", []float64{-4},
			ErrNegativeSquareRoot, "cannot take the square root of a negative number"},

		{"unknown operation", "modulo", []float64{1, 2},
			ErrUnknownOperation, `unknown operation: "modulo"`},
		{"empty operation name", "", []float64{1, 2},
			ErrUnknownOperation, `unknown operation: ""`},
		{"operation names are case-sensitive", "Add", []float64{1, 2},
			ErrUnknownOperation, `unknown operation: "Add"`},

		{"too few operands", "add", []float64{1},
			ErrInvalidOperandCount, `invalid operand count: "add" takes 2, got 1`},
		{"too many operands", "add", []float64{1, 2, 3},
			ErrInvalidOperandCount, `invalid operand count: "add" takes 2, got 3`},
		{"no operands", "squareRoot", nil,
			ErrInvalidOperandCount, `invalid operand count: "squareRoot" takes 1, got 0`},
		{"two operands for a unary operation", "squareRoot", []float64{4, 9},
			ErrInvalidOperandCount, `invalid operand count: "squareRoot" takes 1, got 2`},

		{"overflow", "multiply", []float64{1e308, 10},
			ErrNonFiniteResult, "result is not a finite number"},
		{"negative overflow", "multiply", []float64{-1e308, 10},
			ErrNonFiniteResult, "result is not a finite number"},
		{"overflow in power", "power", []float64{10, 400},
			ErrNonFiniteResult, "result is not a finite number"},
		{"zero to a negative power", "power", []float64{0, -1},
			ErrNonFiniteResult, "result is not a finite number"},
		{"fractional power of a negative base", "power", []float64{-8, 0.5},
			ErrNonFiniteResult, "result is not a finite number"},
	}

	calculator := New()
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := calculator.Compute(testCase.operation, testCase.operands)
			if !errors.Is(err, testCase.want) {
				t.Fatalf("Compute(%q, %v) error = %v; want %v",
					testCase.operation, testCase.operands, err, testCase.want)
			}
			if err.Error() != testCase.wantMessage {
				t.Errorf("error message = %q; want %q", err.Error(), testCase.wantMessage)
			}
			if got != 0 {
				t.Errorf("result alongside an error = %v; want 0", got)
			}
		})
	}
}
