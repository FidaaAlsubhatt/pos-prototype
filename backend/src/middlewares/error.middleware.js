// src/middlewares/error.middleware.js
// Global error handler.

import { ZodError } from 'zod';

export function errorMiddleware(err, req, res, next) {
    // If Express already started sending a response, delegate to default handler
    if (res.headersSent) return next(err);

    // Zod validation errors (body/query parsing)
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: err.issues
            }
        });
    }

    // Mongoose invalid ObjectId errors (prevents 500 on /:id like "abc")
    // Typical message: Cast to ObjectId failed for value "abc" at path "_id"
    if (err?.name === 'CastError' && err?.kind === 'ObjectId') {
        return res.status(400).json({
            error: {
                code: 'INVALID_ID',
                message: `Invalid id format: ${err?.value}`
            }
        });
    }

    // Default behavior for everything else
    const status = err.status || 500;

    return res.status(status).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Something went wrong',
            details: err.details
        }
    });
}