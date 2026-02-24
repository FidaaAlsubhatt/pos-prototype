// src/middlewares/validateObjectId.middleware.js
// Validates that a route param is a valid MongoDB ObjectId.
// Prevents Mongoose CastErrors from turning into 500s.

import mongoose from 'mongoose';

export function validateObjectIdParam(paramName = 'id') {
  return function (req, res, next) {
        const value = req.params[paramName];

        // mongoose.Types.ObjectId.isValid checks if value can be an ObjectId
        if (!mongoose.Types.ObjectId.isValid(value)) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_ID',
                    message: `Invalid id format: ${value}`
                }
            });
        }

        next();
    };
}