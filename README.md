Music Room Slot Booking (Next.js App Router + Firebase)

Features
- Google Sign-In via Firebase Authentication
- Firestore `users` and `bookings`
- Weekly calendar (Mon–Sun, hourly slots)
- One booking per user per day
- Multiple admin emails can reset week and manage cancellations

Setup
1) Create a Firebase project and enable Google Sign-In
- In Firebase Console, enable Authentication > Sign-in methods > Google
- Create a Firestore database in production or test mode

2) Create `.env.local` at project root
Copy this template and fill with your values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com,admin2@example.com

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Notes
- `NEXT_PUBLIC_ADMIN_EMAIL` supports multiple admin emails separated by commas (e.g., `admin@example.com,admin2@example.com`). These admins can reset the week and manage cancellation requests.
- For the Admin SDK, use a Service Account key from Firebase console (Project settings > Service accounts). Replace real newlines with `\n`.

Run
```
npm run dev
```
Open http://localhost:3000.

How it works
- API routes (`/api/book`, `/api/week`, `/api/reset`) use Firebase Admin SDK
- Client gets ID token from Firebase Auth and sends as `Authorization: Bearer <token>`
- `users` doc is upserted on booking; role is derived from admin email
- `bookings` schema: `{ userId, date: 'YYYY-MM-DD', slot: number, createdAt }`
