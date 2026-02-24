// lib/api.js
// Centralised API layer for the POS app.


import { Platform } from "react-native";

/**
 * Expo exposes EXPO_PUBLIC_* env vars to client code.
 * - Web can use localhost fallback
 * - Phone MUST use your Mac LAN IP via EXPO_PUBLIC_API_URL
 */
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const FALLBACK_WEB_URL = "http://localhost:4000";

export const config = {
    API_BASE_URL: ENV_API_BASE_URL || (Platform.OS === "web" ? FALLBACK_WEB_URL : ""),
};

if (!config.API_BASE_URL) {
    // Non-blocking warning: app still loads, but API calls will show a clear error.
    console.warn(
        "[api] Missing EXPO_PUBLIC_API_URL. Create pos-app/.env with EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:4000 then restart Expo."
    );
}

/**
 * Build a fully qualified API URL.
 * Throws a clear error if API_BASE_URL is missing.
 */
function apiUrl(path) {
    if (!config.API_BASE_URL) {
        throw new Error(
            "API base URL is missing. Set EXPO_PUBLIC_API_URL in pos-app/.env and restart Expo."
        );
    }
    return `${config.API_BASE_URL}${path}`;
}

/**
 * Safely parse JSON responses.
 * Backend error shape:
 *   { error: { code, message, details } }
 */
async function parseJsonResponse(response) {
    const text = await response.text();

    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // Non-JSON response (HTML error page, proxy issue, etc.)
    }

    if (!response.ok) {
        const err = data?.error || {};
        const message = err.message || text || `Request failed (${response.status})`;

        const error = new Error(message);
        error.code = err.code || "REQUEST_FAILED";
        error.details = err.details;
        error.status = response.status;
        error.raw = data;
        throw error;
    }

    return data;
}

/**
 * Small helper for consistent JSON requests.
 * @param {string} path - "/api/..."
 * @param {object} options - fetch options (method/body/headers)
 */
async function jsonRequest(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(apiUrl(path), {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return parseJsonResponse(res);
}

/* =========================
   Health
   ========================= */

export async function healthCheck() {
    return jsonRequest("/health");
}

/* =========================
   Payment Intents
   ========================= */

/**
 * Create a payment intent
 * POST /api/payment-intents
 *
 * @param {object} input
 * @param {number} input.amount - minor units (e.g. 1250 = £12.50)
 * @param {"QR"|"CARD"} [input.method]
 * @param {string} [input.currency] - e.g. "GBP"
 * @param {number} [input.expiresInSeconds]
 *
 * @param {object} [options]
 * @param {string} [options.idempotencyKey] - optional retry-safe key
 */
export async function createPaymentIntent(
    { amount, method, currency, expiresInSeconds },
    options = {}
) {
    const body = { amount };

    if (method) body.method = method;
    if (currency) body.currency = currency;
    if (typeof expiresInSeconds === "number") body.expiresInSeconds = expiresInSeconds;

    const headers = {};
    if (options.idempotencyKey) {
        headers["Idempotency-Key"] = options.idempotencyKey;
    }

    return jsonRequest("/api/payment-intents", {
        method: "POST",
        body,
        headers,
    });
}

/**
 * Get payment intent by ID
 * GET /api/payment-intents/:id
 */
export async function getPaymentIntent(id) {
    return jsonRequest(`/api/payment-intents/${id}`);
}

/**
 * Confirm payment (simulate success)
 * POST /api/payment-intents/:id/confirm
 */
export async function confirmPaymentIntent(id) {
    return jsonRequest(`/api/payment-intents/${id}/confirm`, { method: "POST" });
}

/**
 * Fail payment (simulate decline)
 * POST /api/payment-intents/:id/fail
 */
export async function failPaymentIntent(id, { reason } = {}) {
    return jsonRequest(`/api/payment-intents/${id}/fail`, {
        method: "POST",
        body: reason ? { reason } : {},
    });
}

/**
 * Cancel payment (merchant cancels)
 * POST /api/payment-intents/:id/cancel
 */
export async function cancelPaymentIntent(id) {
    return jsonRequest(`/api/payment-intents/${id}/cancel`, { method: "POST" });
}

/**
 * List recent payments
 * GET /api/payment-intents?limit=...&status=...
 */
export async function listPaymentIntents({ limit = 20, status } = {}) {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (status) params.set("status", status);

    // Backend response is: { items: [...] }
    return jsonRequest(`/api/payment-intents?${params.toString()}`);
}