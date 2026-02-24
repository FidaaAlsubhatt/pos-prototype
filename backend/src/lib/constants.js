// src/lib/constants.js
// Central place for domain constants used across the backend.
// Keeping these here avoids hardcoding strings everywhere.

// Payment status lifecycle
export const PAYMENT_STATUSES = {
    PENDING: 'PENDING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED'
};

// Terminal states — once a payment reaches these, it cannot change
export const TERMINAL_STATUSES = new Set([
    PAYMENT_STATUSES.SUCCEEDED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.CANCELLED,
    PAYMENT_STATUSES.EXPIRED
]);

// Default values for the prototype
export const DEFAULT_CURRENCY = 'GBP';

// 5 minutes expiry is common for QR payments
export const DEFAULT_EXPIRY_SECONDS = 5 * 60;

// Single demo merchant (no auth in prototype)
export const DEMO_MERCHANT_ID = 'demo-merchant';