// src/app.js
// Express app wiring: middleware, routes, error handling.

import express from "express";
import cors from "cors";

import { apiRouter } from "./routes/index.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { PaymentIntent } from "./models/PaymentIntent.model.js";

function formatMoneyMinor(amountMinor, currency = "GBP") {
    const symbol = currency === "GBP" ? "£" : "";
    const major = Math.floor(amountMinor / 100);
    const minor = Math.abs(amountMinor % 100);
    return `${symbol}${major}.${String(minor).padStart(2, "0")}`;
}

//  small HTML escaping to avoid weird rendering if ids contain special chars
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function buildApp({ baseUrl }) {
    const app = express();

    // Used to generate customerUrl like http://<host>:4000/pay/:id
    app.locals.baseUrl = baseUrl;

    // Allow requests from Expo (phone/web) + local tools
    app.use(cors());

    app.use(express.json());

    app.get("/health", (req, res) => {
        res.json({ ok: true });
    });

    // Mount API routes
    app.use("/api", apiRouter);

    /**
     * Demo customer payment page
     * Simulates customer scanning QR and confirming.
     */
    app.get("/pay/:id", async (req, res, next) => {
        try {
            const paymentId = req.params.id;

            // Load intent to show real amount + status
            const intent = await PaymentIntent.findById(paymentId).lean();

            if (!intent) {
                res.status(404).setHeader("Content-Type", "text/html");
                return res.send(`
          <html>
            <body style="font-family: -apple-system, system-ui, sans-serif; padding: 24px;">
              <h2>Payment not found</h2>
              <p>No payment exists for ID: <b>${escapeHtml(paymentId)}</b></p>
            </body>
          </html>
        `);
            }

            const amountText = formatMoneyMinor(intent.amount, intent.currency);
            const status = intent.status;
            const method = intent.method;

            res.setHeader("Content-Type", "text/html");
            res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Customer Payment</title>
          </head>
          <body style="font-family: -apple-system, system-ui, sans-serif; padding: 24px; max-width: 520px; margin: 0 auto;">
            <h2 style="margin: 0 0 12px;">Pay ${escapeHtml(amountText)}</h2>

            <div style="background:#f5f5f7; border-radius: 14px; padding: 14px; margin-bottom: 16px;">
              <div style="margin-bottom: 6px;">Payment ID: <b>${escapeHtml(paymentId)}</b></div>
              <div style="margin-bottom: 6px;">Method: <b>${escapeHtml(method)}</b></div>
              <div style="margin-bottom: 6px;">Status: <b id="status">${escapeHtml(status)}</b></div>
              <div>Amount: <b>${escapeHtml(amountText)}</b></div>
            </div>

            <div style="display:flex; gap: 10px; margin-bottom: 12px;">
              <button onclick="confirmPayment()"
                style="flex:1; font-size: 18px; padding: 14px 16px; border-radius: 14px; border: none; background:#111827; color:white; font-weight: 700;">
                Confirm
              </button>

              <button onclick="failPayment()"
                style="flex:1; font-size: 18px; padding: 14px 16px; border-radius: 14px; border: 2px solid #111827; background:white; color:#111827; font-weight: 700;">
                Fail
              </button>
            </div>

            <pre id="result" style="margin-top: 12px; background: #0b0f1a; color: #e5e7eb; padding: 12px; border-radius: 14px; overflow:auto;"></pre>

            <script>
              async function post(path, body) {
                const res = await fetch(path, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: body ? JSON.stringify(body) : undefined
                });
                const text = await res.text();
                let json = null;
                try { json = text ? JSON.parse(text) : null; } catch {}
                if (!res.ok) throw new Error((json && json.error && json.error.message) || text || 'Request failed');
                return json;
              }

              function render(json) {
                document.getElementById('result').textContent = JSON.stringify(json, null, 2);
                if (json && json.status) {
                  document.getElementById('status').textContent = json.status;
                }
              }

              async function confirmPayment() {
                try {
                  const json = await post('/api/payment-intents/${escapeHtml(paymentId)}/confirm');
                  render(json);
                } catch (e) {
                  render({ error: String(e.message || e) });
                }
              }

              async function failPayment() {
                try {
                  const json = await post('/api/payment-intents/${escapeHtml(paymentId)}/fail', { reason: 'DECLINED' });
                  render(json);
                } catch (e) {
                  render({ error: String(e.message || e) });
                }
              }
            </script>
          </body>
        </html>
      `);
        } catch (err) {
            next(err);
        }
    });

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}