// src/config/env.js
// Loads environment variables from .env and exports a single "env" config object.
// This keeps configuration centralized and makes startup predictable.

import dotenv from 'dotenv';

// Load variables from backend/.env into process.env
dotenv.config();

/**
 * Helper: ensures required env var exists.
 * If missing, we throw a clear error and fail fast.
 */
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

// Export a single config object used across the backend
export const env = {
    // Port where Express will listen
    port: Number(process.env.PORT || 4000),

    // MongoDB Atlas connection string
    mongoUrl: requireEnv('MONGO_URL'),

    // Fail fast on unreachable Mongo during local dev (default 5s)
    mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),

    // Base URL used to generate customerUrl for QR links
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`
};
