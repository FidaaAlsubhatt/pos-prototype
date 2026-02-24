// src/controllers/paymentIntent.controller.js
// Controllers handle HTTP concerns only:
// - read req.body / req.params / req.query
// - validate inputs (Zod)
// - call service functions
// - return JSON responses

import { z } from 'zod';

import {
    createPaymentIntent,
    getPaymentIntentById,
    confirmPaymentIntent,
    failPaymentIntent,
    cancelPaymentIntent,
    listPaymentIntents
} from '../services/paymentIntent.service.js';

/**
 * Zod schema: validate the "create payment intent" request body.
 * We keep amounts in minor units (pence) to avoid floating point issues.
 *
 * Example valid body:
 * { "amount": 1250, "method": "QR" }
 */
const createSchema = z.object({
    // amount in minor units (e.g., 1250 = £12.50)
    amount: z.number().int().positive(),

    // ISO currency code (3 letters). Optional; defaults in service.
    currency: z.string().length(3).optional(),

    // Optional; defaults in service
    method: z.enum(['CARD', 'QR']).optional(),

    // Optional expiry in seconds (max 1 hour). Defaults in service.
    expiresInSeconds: z.number().int().positive().max(60 * 60).optional()
});

/**
 * Zod schema: validate body for failing a payment.
 * Reason is optional, but if present must be <= 100 chars.
 */
const failSchema = z.object({
    reason: z.string().max(100).optional()
});

/**
 * Zod schema: validate query params for listing payment intents.
 * Express query params come in as strings, so:
 * - z.coerce.number() converts "10" -> 10 safely
 *
 * Example:
 * /api/payment-intents?limit=10&status=SUCCEEDED
 */
const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']).optional()
});

/**
 * POST /api/payment-intents
 * Merchant creates a payment request.
 */
export async function createPaymentIntentController(req, res, next) {
    try {
        // Validate request body (throws ZodError if invalid)
        const input = createSchema.parse(req.body);

        // Optional idempotency key for safe retries from POS
        // If caller repeats the same request with same key, we return the same record.
        const idempotencyKey = req.header('Idempotency-Key') || undefined;

        const dto = await createPaymentIntent({
            ...input,
            idempotencyKey,

            // baseUrl is used to generate customerUrl for the QR code
            baseUrl: req.app.locals.baseUrl
        });

        // Created
        res.status(201).json(dto);
    } catch (err) {
        // Forward error to global error middleware
        next(err);
    }
}

/**
 * GET /api/payment-intents/:id
 * POS polls a payment intent to see updated status.
 */
export async function getPaymentIntentController(req, res, next) {
    try {
        const dto = await getPaymentIntentById({
            id: req.params.id,
            baseUrl: req.app.locals.baseUrl
        });

        res.json(dto);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payment-intents/:id/confirm
 * Simulates customer successful payment.
 * (In a real system, this would be webhook/processor-driven.)
 */
export async function confirmPaymentIntentController(req, res, next) {
    try {
        const dto = await confirmPaymentIntent({
            id: req.params.id,
            baseUrl: req.app.locals.baseUrl
        });

        res.json(dto);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payment-intents/:id/fail
 * Simulates a failure (e.g., "card declined").
 */
export async function failPaymentIntentController(req, res, next) {
    try {
        // If no body was sent, treat as empty object for schema parse
        const body = failSchema.parse(req.body || {});

        const dto = await failPaymentIntent({
            id: req.params.id,
            reason: body.reason,
            baseUrl: req.app.locals.baseUrl
        });

        res.json(dto);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payment-intents/:id/cancel
 * Merchant cancels the payment request.
 */
export async function cancelPaymentIntentController(req, res, next) {
    try {
        const dto = await cancelPaymentIntent({
            id: req.params.id,
            baseUrl: req.app.locals.baseUrl
        });

        res.json(dto);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/payment-intents?limit=50&status=SUCCEEDED
 * Used by the POS "Transactions" screen.
 */
export async function listPaymentIntentsController(req, res, next) {
    try {
        // Validate query params (throws ZodError on invalid)
        const query = listQuerySchema.parse(req.query);

        const items = await listPaymentIntents({
            limit: query.limit ?? 50,
            status: query.status,
            baseUrl: req.app.locals.baseUrl
        });

        // Consistent list response shape (useful for the mobile UI)
        res.json({ items });
    } catch (err) {
        next(err);
    }
}