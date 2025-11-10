# Backend Overview

## Structure

```
Backend/
  server.js                # App entrypoint
  models/
    user.js                # User schema (auth + cart + favorites + settings + address)
    order.js               # Order schema (items + pricing + payment + address)
    schemas/
      address.js           # Shared embedded address schema
  middleware/
    auth.js                # JWT auth middleware (sets req.user)
    logger.js              # Request logging middleware
  routes/
    authRoutes.js          # Register/Login endpoints
    paymentRoutes.js       # Razorpay create & verify endpoints
    userDataRoutes.js      # User-specific data (cart, favorites, address, settings)
    orderRoutes.js         # Create and list orders
  scripts/
    seedProducts.js        # (Example) product seeding script
```

## Key Models

### User
Fields: name, email, password (hashed), cart[], favorites[], address{}, settings{}
Cart item: { name, price, quantity, measure, unit, image, lineTotal }

### Order
Links to user via `user` ObjectId.
Fields: items[], pricing{}, deliverySlot, payment{}, address{}
Payment object includes: method, paymentId (if Razorpay), status, optional upiId/cardLast4.

### Address (Embedded)
Common structure reused for both User and Order. All fields optional for flexibility; add validation later if needed.

## Auth
JWT issued on login/register. `auth.js` expects `Authorization: Bearer <token>` and attaches `req.user` (with _id, name, email) for protected routes.

## Orders Flow
1. Client builds order payload (items, pricing, payment, address).
2. POST `/api/orders` with JWT: returns `{ id }` on success.
3. GET `/api/orders` returns array of normalized orders (newest first).

## Payments (Razorpay)
- `POST /api/payments/razorpay/create-order` creates a Razorpay order (amount in paise).
- Client opens Razorpay checkout.
- `POST /api/payments/razorpay/verify` verifies signature.
- On success, client posts the order to `/api/orders`.

## Environment Variables (.env)
```
PORT=5001
MONGO_URI=mongodb://localhost:27017/fruit_shop
JWT_SECRET=your_jwt_secret_here
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_secret_here
```

## Useful Development Commands
```bash
npm install
npm run dev    # nodemon server
```

## Next Improvements
- Add field validation (e.g., require address.name for order placement).
- Add pagination for `/api/orders`.
- Implement product catalog in DB (currently only client-side JSON assets).
