// src/services/paymentIntent.service.js
// Services contain payment business logic (state rules, expiry, atomic updates).
// Controllers should remain thin and call these functions.

import { PaymentIntent } from '../models/PaymentIntent.model.js';
import {
    PAYMENT_STATUSES,
    TERMINAL_STATUSES,
    DEFAULT_CURRENCY,
    DEFAULT_EXPIRY_SECONDS,
    DEMO_MERCHANT_ID
} from '../lib/constants.js';
import { AppError } from '../lib/errors.js';

/**
 * Create a payment intent (merchant requests a payment).
 * For UX simplicity, we start in PENDING ("waiting for customer").
 */
export async function createPaymentIntent({ amount, currency, method, expiresInSeconds, idempotencyKey, baseUrl }) {
    const now = new Date();

    const expSeconds = expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS;
    const expiresAt = new Date(now.getTime() + expSeconds * 1000);

    try {
        const doc = await PaymentIntent.create({
            merchantId: DEMO_MERCHANT_ID,
            amount,
            currency: currency ?? DEFAULT_CURRENCY,
            method: method ?? 'QR',
            status: PAYMENT_STATUSES.PENDING,
            expiresAt,
            idempotencyKey
        });

        return toDto(doc, baseUrl);
    } catch (err) {
        // If we used Idempotency-Key and created a duplicate, return existing record
        if (err?.code === 11000 && idempotencyKey) {
            const existing = await PaymentIntent.findOne({ merchantId: DEMO_MERCHANT_ID, idempotencyKey });
            if (!existing) throw err;
            return toDto(existing, baseUrl);
        }
        throw err;
    }
}

/**
 * Fetch an intent and enforce expiry.
 * If time has passed, we mark it EXPIRED (unless it's already terminal).
 */
export async function getPaymentIntentById({ id, baseUrl }) {
    const doc = await PaymentIntent.findById(id);
    if (!doc) throw new AppError('NOT_FOUND', 'Payment not found', 404);

    const now = new Date();

    if (!TERMINAL_STATUSES.has(doc.status) && doc.expiresAt <= now) {
        doc.status = PAYMENT_STATUSES.EXPIRED;
        await doc.save();
    }

    return toDto(doc, baseUrl);
}

/**
 * Confirm payment success (simulated).
 * This must be atomic: it should only succeed if not terminal and not expired.
 */
export async function confirmPaymentIntent({ id, baseUrl }) {
    const now = new Date();

    const updated = await PaymentIntent.findOneAndUpdate(
        {
            _id: id,
            status: { $nin: Array.from(TERMINAL_STATUSES) },
            expiresAt: { $gt: now }
        },
        { $set: { status: PAYMENT_STATUSES.SUCCEEDED } },
        { new: true }
    );

    if (!updated) {
        throw await explainGuardFailure(id, now);
    }

    return toDto(updated, baseUrl);
}

/**
 * Fail payment (simulated decline).
 */
export async function failPaymentIntent({ id, reason, baseUrl }) {
    const now = new Date();

    const updated = await PaymentIntent.findOneAndUpdate(
        {
            _id: id,
            status: { $nin: Array.from(TERMINAL_STATUSES) },
            expiresAt: { $gt: now }
        },
        { $set: { status: PAYMENT_STATUSES.FAILED, failureReason: reason ?? 'DECLINED' } },
        { new: true }
    );

    if (!updated) {
        throw await explainGuardFailure(id, now);
    }

    return toDto(updated, baseUrl);
}

/**
 * Cancel payment (merchant cancels).
 */
export async function cancelPaymentIntent({ id, baseUrl }) {
    const now = new Date();

    const updated = await PaymentIntent.findOneAndUpdate(
        {
            _id: id,
            status: { $nin: Array.from(TERMINAL_STATUSES) },
            expiresAt: { $gt: now }
        },
        { $set: { status: PAYMENT_STATUSES.CANCELLED } },
        { new: true }
    );

    if (!updated) {
        throw await explainGuardFailure(id, now);
    }

    return toDto(updated, baseUrl);
}

/**
 * List recent payment intents (Transactions screen).
 * We keep it simple: latest first, optional status filter.
 *
 * IMPORTANT:
 * - We also "sweep" expired PENDING intents before returning the list,
 *   so the Transactions screen doesn't show stale PENDING payments.
 */
export async function listPaymentIntents({ limit = 50, status, baseUrl }) {
    const now = new Date();

    // 1) Mark any expired PENDING intents as EXPIRED (keeps list accurate)
    await PaymentIntent.updateMany(
        {
            merchantId: DEMO_MERCHANT_ID,
            status: PAYMENT_STATUSES.PENDING,
            expiresAt: { $lte: now }
        },
        {
            $set: { status: PAYMENT_STATUSES.EXPIRED }
        }
    );

    // 2) Build query for listing
    const query = { merchantId: DEMO_MERCHANT_ID };

    // Optional filter (e.g. status=SUCCEEDED)
    if (status) {
        query.status = status;
    }

    // 3) Fetch newest first (limit capped for safety)
    const docs = await PaymentIntent.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 200));

    return docs.map((d) => toDto(d, baseUrl));
}

/**
 * Helper: build a consistent DTO for API responses.
 */
function toDto(doc, baseUrl) {
    return {
        id: doc._id.toString(),
        merchantId: doc.merchantId,
        amount: doc.amount,
        currency: doc.currency,
        method: doc.method,
        status: doc.status,
        failureReason: doc.failureReason ?? null,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,

        // This is what the POS app shows as QR code
        customerUrl: `${baseUrl}/pay/${doc._id.toString()}`
    };
}

// explainGuardFailure is used when an atomic update fails.
// IMPORTANT: terminal-state should be checked first.
// A payment that is already SUCCEEDED should not suddenly be treated as "expired".
async function explainGuardFailure(id, now) {
    const existing = await PaymentIntent.findById(id);

    if (!existing) {
        return new AppError('NOT_FOUND', 'Payment not found', 404);
    }

    //  Terminal state has priority (no double processing)
    if (TERMINAL_STATUSES.has(existing.status)) {
        return new AppError('PAYMENT_ALREADY_FINAL', `Payment is ${existing.status}`, 409);
    }

    //  Only treat it as expired if it is NOT terminal
    if (existing.expiresAt <= now) {
        return new AppError('PAYMENT_EXPIRED', 'Payment has expired', 400);
    }

    return new AppError('PAYMENT_UPDATE_BLOCKED', 'Payment could not be updated', 400);

}