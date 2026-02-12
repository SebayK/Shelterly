/**
 * Custom error classes for better error handling
 */

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class InternalError extends Error {
  constructor(message = "An internal error occurred") {
    super(message);
    this.name = "InternalError";
  }
}

export class AddressNotFoundError extends Error {
  constructor(message = "Address not found by geocoding service") {
    super(message);
    this.name = "AddressNotFoundError";
  }
}
