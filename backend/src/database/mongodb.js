// src/database/mongodb.js
// Responsible ONLY for connecting to MongoDB Atlas.

import mongoose from 'mongoose';

/**
 * Connect to MongoDB using Mongoose.
 * Called once during server startup.
 *
 * @param {string} mongoUrl - MongoDB connection string
 * @param {object} options - Optional mongoose options
 */
export async function connectMongo(mongoUrl, options = {}) {
    if (!mongoUrl) {
        throw new Error('MongoDB connection string is missing');
    }

    // Prevent unexpected query behavior
    mongoose.set('strictQuery', true);

    const startedAt = Date.now();
    console.log('[db] Connecting to MongoDB...');

    await mongoose.connect(mongoUrl, options);

    console.log(`[db] Connected to MongoDB in ${Date.now() - startedAt}ms`);
}