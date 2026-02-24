// src/middlewares/notFound.middleware.js
// Handles any request that doesn't match a route.
// This prevents confusing HTML errors and keeps the API consistent.

export function notFoundMiddleware(req, res) {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route not found: ${req.method} ${req.originalUrl}`
        }
    });
}