// src/models/PaymentIntent.model.js
// This file defines the MongoDB schema (shape) for a PaymentIntent.
// PaymentIntent = "merchant requests a payment of X using method Y".
// Store amount in minor units (pence) to avoid floating point issues.

import { createRequire } from 'node:module';
import { PAYMENT_STATUSES } from '../lib/constants.js';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema(
    {
        // In the prototype we hardcode a single merchantId ("demo-merchant")
        // but we still store it so the model is realistic.
        merchantId: {
            type: String,
            required: true,
            index: true
        },

        // Amount in minor units (e.g. 1250 = £12.50)
        amount: {
            type: Number,
            required: true,
            min: 1
        },

        // ISO 4217 currency code (e.g. GBP)
        currency: {
            type: String,
            required: true,
            default: 'GBP'
        },

        // Payment method selected by the merchant
        method: {
            type: String,
            enum: ['CARD', 'QR'],
            required: true
        },

        // Payment status lifecycle
        status: {
            type: String,
            enum: Object.values(PAYMENT_STATUSES),
            required: true,
            index: true
        },

        // When the payment should expire (QR payments commonly expire)
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },

        // Optional: idempotency key to prevent duplicates if POS retries the create call
        idempotencyKey: {
            type: String
        },

        // Optional: store why a payment failed (simulated)
        failureReason: {
            type: String
        }
    },
    {
        // Adds createdAt and updatedAt automatically
        timestamps: true
    }
);


// Partial index means it only applies when idempotencyKey exists.
PaymentIntentSchema.index(
    { merchantId: 1, idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } }
    }
);

// Helpful index for Transactions list (recent first)
PaymentIntentSchema.index({ merchantId: 1, createdAt: -1 });

// Export model (Mongoose creates a "paymentintents" collection by default)
export const PaymentIntent = mongoose.model('PaymentIntent', PaymentIntentSchema);
