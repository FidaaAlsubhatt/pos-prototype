# StickyPOS Prototype (POS Payment Flow Demo)

Clickable POS payment app prototype for a small merchant/cashier workflow.

This project is a UI/UX + basic app logic prototype:
- No real payments
- No payment processor integrations
- No scraping or external data sources
- Merchant-friendly flow (big buttons, minimal steps, clear errors)

It includes:
- an Expo mobile app (`pos-app/`) for the cashier/merchant experience
- an Express + MongoDB backend (`backend/`) that simulates payment intent state transitions

## Brief Fit (What This Prototype Demonstrates)

The prototype is designed to match the requested flow:
- `New Payment` screen with large keypad and quick amount buttons
- `Debit Card` and `QR` payment methods
- Clear payment states (`pending`, `approved`, `failed`, `cancelled`, `expired`)
- Transactions overview with status filters
- Simple, merchant-friendly interactions with minimal steps


## What Is Implemented

### Frontend (Expo Router)
- Merchant home screen (`POS`, `New Payment`, `Transactions`)
- New payment flow:
  - amount entry keypad (minor units via digits)
  - quick amount buttons (`+£5`, `+£10`, `+£20`)
  - method toggle (`CARD`, `QR`)
- Payment screen:
  - live polling of backend payment status
  - QR rendering from backend `customerUrl`
  - countdown to expiry
  - simulate `Approve`, `Decline`, `Cancel`
  - terminal actions (`New Payment`, `Done`)
- Transactions list:
  - recent payments
  - status filters
  - tap row to reopen payment

### Backend (Express + MongoDB)
- Creates payment intents
- Returns `customerUrl` for QR/customer demo page
- Simulates confirm / fail / cancel actions
- Stores payment intents in MongoDB
- Enforces:
  - terminal states
  - expiry
  - idempotent create (optional `Idempotency-Key`)
- Provides a demo customer page at `/pay/:id`

## Tech Stack

### Frontend (`pos-app/`)
- Expo
- React Native

### Backend (`backend/`)
- Node.js
- Express
- MongoDB + Mongoose

## Project Structure

```text
pos-prototype/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/env.js
│   │   ├── database/mongodb.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   └── middlewares/
│   └── .env.example
├── pos-app/
│   ├── app/
│   │   ├── (tabs)/
│   │   ├── new-payment.tsx
│   │   ├── payment/[id].tsx
│   │   └── transactions.tsx
│   └── lib/api.js
└── README.md
```

## Local Setup

## 1) Backend setup (`backend/`)

Create env file from the example:

```bash
cd backend
cp .env.example .env
```

Set these values in `backend/.env`:
- `MONGO_URL` (required)
- `PORT` (optional, default `4000`)
- `BASE_URL` (important for QR/customer links)

Install and run:

```bash
cd backend
npm install
npm run dev
```

Health check:

```bash
curl http://localhost:4000/health
```

Expected:

```json
{"ok":true}
```

## 2) Frontend setup (`pos-app/`)

Create `pos-app/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000
```

Examples:
- Web/local only: `http://localhost:4000`
- Real phone on same Wi-Fi: `http://192.168.x.x:4000`

Install and run:

```bash
cd pos-app
npm install
npx expo start
```

or:

```bash
npm run web
```

### Important (Phone testing)

If you test on a real phone:
- `EXPO_PUBLIC_API_URL` must use your laptop LAN IP (not `localhost`)
- `backend/.env` `BASE_URL` should match that same backend URL so the QR/customer link works

Example:
- `EXPO_PUBLIC_API_URL=http://192.168.0.100:4000`
- `BASE_URL=http://192.168.0.100:4000`

## How the Prototype Flow Works (Demo Script)

### QR payment demo
1. Open app -> tap `New Payment`
2. Enter amount -> choose `QR`
3. Tap `Create Payment`
4. App shows QR + countdown (`Waiting for customer...`)
5. Tap `Open Customer Page` (or open the QR link manually)
6. On customer page, click `Confirm` or `Fail`
7. Merchant app updates status automatically via polling
8. Open `Transactions` to show the recorded payment

### Card payment demo
1. Open app -> tap `New Payment`
2. Enter amount -> choose `CARD`
3. Tap `Create Payment`
4. Merchant sees card payment screen
5. Tap `Approve` or `Decline` (simulated terminal result)
6. Status updates and payment appears in `Transactions`

## Troubleshooting

### Frontend cannot reach backend (phone)
- `localhost` on phone points to the phone, not your laptop
- Use your laptop LAN IP in `EXPO_PUBLIC_API_URL`

### QR opens wrong host
- `customerUrl` comes from backend `BASE_URL` (or request host)
- Make sure backend URL used by frontend and backend-generated URL match

