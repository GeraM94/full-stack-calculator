// Mirror of the Go structs in backend/internal/httpapi/types.go. Field names
// are the JSON tags, verbatim.

export type Operation =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "squareRoot"
  | "percentage";

export interface CalculateRequest {
  operation: Operation;
  operands: number[];
}

export interface CalculateResponse {
  result: number;
}

/** The codes the server sends, plus two that the client raises by itself. */
export type ErrorCode =
  | "INVALID_JSON"
  | "REQUEST_TOO_LARGE"
  | "UNKNOWN_OPERATION"
  | "INVALID_OPERAND_COUNT"
  | "DIVISION_BY_ZERO"
  | "NEGATIVE_SQUARE_ROOT"
  | "NON_FINITE_RESULT"
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  /** The request never got an answer from the API. */
  | "NETWORK_ERROR"
  /** An answer arrived, but not in the shape of the contract. */
  | "INVALID_RESPONSE";

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
}

/** The envelope of every error the API returns. */
export interface ErrorResponse {
  error: ErrorDetail;
}

/** What the client throws for anything other than a result. */
export class ApiError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}
