// src/lib/errors.js
// A small custom error class used across services.

export class AppError extends Error {
    constructor(code, message, status = 400, details = undefined) {
        super(message);
        this.code = code;       // machine-readable error code
        this.status = status;   // HTTP status code (400, 404, 409, etc.)
        this.details = details; // optional extra info
    }
}