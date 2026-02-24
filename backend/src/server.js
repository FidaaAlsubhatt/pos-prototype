// src/server.js
// Backend entry point.
// It connects to the database, builds the app, and starts the HTTP server.

import { env } from './config/env.js';
import { connectMongo } from './database/mongodb.js';
import { buildApp } from './app.js';

async function startServer() {
    const startupStartedAt = Date.now();

    // 1. Connect to MongoDB Atlas
    // If this fails, the server should NOT start
    await connectMongo(env.mongoUrl, {
        serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs
    });

    // 2. Build the Express app
    const app = buildApp({ baseUrl: env.baseUrl });

    // 3. Start listening for HTTP requests
    app.listen(env.port, () => {
        console.log(`[api] Server running at ${env.baseUrl} (startup ${Date.now() - startupStartedAt}ms)`);
    });
}

// Start the server and fail fast if something goes wrong
startServer().catch((err) => {
    console.error('[startup] Failed to start server:', err);
    process.exit(1);
});
