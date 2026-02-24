// src/routes/index.js
// Collects and mounts all API routes in one place.
// Keeps app.js clean and makes it easy to add new features later.

import express from 'express';
import { paymentIntentRouter } from './paymentIntent.routes.js';

export const apiRouter = express.Router();

// Mount the Payment Intent routes
apiRouter.use(paymentIntentRouter);