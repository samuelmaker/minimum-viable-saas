# Minimum Viable SaaS

A feature-complete membership app in less than ~400 lines of code.

## Built with

- Next.js
- Firebase Auth
- Firebase Firestore
- Firebase Stripe Extension
- Stripe Customer Portal
- Tailwind

## Features

- Login/Logout
- 2 product tiers (Basic and Premium) with 2 price plans each (monthly and yearly)
- Subscription management, card management, and plan cancellation via Stripe Customer Portal
- Basic-only content
- Premium-only content

## Background

I saw a tweet about a new Firebase Firestore Extension for Stripe's new customer billing portal. This new portal lets end-users change plans and update their billing info via stripe.com instead of in your app--saving you thousands of lines of UI code and headaches.

Anyways, after seeing this, I had to see just how many lines it code it would take to build a minimally viable membership/saas site.

**Turns out it takes less than 300-400 lines of code.** It took me around 2 hours to figure this all out, but that's because I semi-forgot how Firebase worked (hint: subscriptions).

Most of the code comes straight from the `next-firebase-authentication` Next.js example. After that it's almost entirely ripped from the Stripe sample.

While I'm still not a fan of Firebase, I think this setup is by far the fewest possible lines of code required to get \$\$\$\$ selling some software as a service.


## Security and local setup

Use Node.js 22.13 or newer and Yarn Classic. Copy `.env.example` to
`.env.local` and enter the public Firebase configuration. Enable Email/Password
sign-in in Firebase Auth. Sessions are observed through the Firebase SDK;
the old `auth` JSON cookie is discarded and cannot establish an identity.
Existing Firebase email/password accounts continue to work. New accounts use
at least 12 characters in the UI; enforce password policy in Firebase as well.

The app preserves the existing singular `customer` and `product` collections.
Review `firestore.rules` against your project and extension configuration before
explicitly deploying them. Customers cannot modify their billing or subscription
records. The Stripe extension's trusted server credentials create those records
and set the signed `stripeRole` claim. Basic/premium content access is enforced
by Firestore, including reads made outside this UI. These rules are not deployed
by building or testing this repository.

Checkout waits for a server-created `url` in its own checkout session. It requires
an extension version that writes this field (the old `sessionId`-only flow is no
longer supported). Set `NEXT_PUBLIC_STRIPE_EXTENSION_ID` if your installed
extension has a different instance ID. Only HTTPS Stripe checkout/portal URLs
are accepted by default; add an exact, trusted custom billing origin to
`NEXT_PUBLIC_BILLING_ALLOWED_ORIGINS` only if your Stripe setup needs it.

Run `yarn test` for redirect validation. For the Firebase regressions, start
Auth and Firestore with a locally installed Firebase CLI:

```sh
firebase emulators:start --only auth,firestore --project demo-security-minimum
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9399 FIRESTORE_EMULATOR_HOST=127.0.0.1:8380 yarn test:emulators
```

For a browser test, use the public values in `.env.example`, set
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, and restart/rebuild Next.js. Emulator
connections are restricted to loopback, including callable Functions; no real
Stripe or Firebase credentials are needed. The automated suite covers actual SDK
authentication, cross-account access, protected billing fields, role-gated content,
checkout responses, and timeouts. Production builds and local account browser
flows were verified. Live Stripe checkout, subscription webhooks, portal changes,
and the deployed project's rules/configuration still require integration review.
