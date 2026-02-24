// src/routes/paymentIntent.routes.js
// Routes define the API endpoints and map them to controller functions.
// Routes should not contain business logic.

import express from 'express';
import {
    createPaymentIntentController,
    getPaymentIntentController,
    confirmPaymentIntentController,
    failPaymentIntentController,
    cancelPaymentIntentController,
    listPaymentIntentsController,
} from '../controllers/paymentIntent.controller.js';

import { validateObjectIdParam } from '../middlewares/validateObjectId.middleware.js';

export const paymentIntentRouter = express.Router();

// Create a new payment request
paymentIntentRouter.post('/payment-intents', createPaymentIntentController);

// List recent payments (used for Transactions screen)
paymentIntentRouter.get('/payment-intents', listPaymentIntentsController);

// Get a specific payment intent (POS polling)
paymentIntentRouter.get('/payment-intents/:id', validateObjectIdParam('id'), getPaymentIntentController);

// Simulate customer payment success
paymentIntentRouter.post('/payment-intents/:id/confirm', validateObjectIdParam('id'), confirmPaymentIntentController);

// Simulate payment failure (e.g., card declined)
paymentIntentRouter.post('/payment-intents/:id/fail', validateObjectIdParam('id'), failPaymentIntentController);

// Merchant cancels the payment
paymentIntentRouter.post('/payment-intents/:id/cancel', validateObjectIdParam('id'), cancelPaymentIntentController);