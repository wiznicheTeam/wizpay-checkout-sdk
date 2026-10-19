# WIZPay Checkout SDK

Take card and ACH payments on your own website. Card fields are hosted by
[Basis Theory](https://basistheory.com), so **card data never touches your
servers** and your integration stays in PCI **SAQ-A** rather than SAQ-D.

```
npm install @wizpay/checkout-sdk
```

---

## How it fits together

Two steps, and the split between them is the whole security model:

1. **Your server** creates a checkout session with your **secret key**. This is
   where the amount is set.
2. **Your page** renders that session with your **publishable key**.

The amount is fixed in step 1 and is never accepted from the browser again, so
a page — and this SDK, which is open source and fully readable — can never
choose its own price.

| Key | Where it lives | What it can do |
|---|---|---|
| `wzp_pk_test_…` / `wzp_pk_live_…` | Your page. Public by design. | Render a checkout and confirm the session it was given. |
| `wzp_test_…` / `wzp_live_…` | **Your server only.** | Create sessions, capture, refund. |

> **Never put a secret key in browser code.** Anyone viewing the page can read
> it. The SDK detects this and refuses to start.

### Test and live

There is no `mode` option and no second URL. The key decides: `wzp_pk_test_…`
sees test data and never moves real money, `wzp_pk_live_…` does. **Going live is
swapping two keys** — one on your server, one on your page.

While a test key is in use the form shows a **TEST MODE** badge, so test keys
accidentally shipped to production are visible rather than silent.

---

## Server

```js
import { WizPayCheckout } from '@wizpay/checkout-sdk/server';

const wizpay = new WizPayCheckout({ secretKey: process.env.WIZPAY_SECRET_KEY });

const session = await wizpay.sessions.create({
  storeId: 'store_abc',
  amountMinor: 12_500,          // $125.00 — integer minor units, never 125.00
  currency: 'USD',
  merchantReference: order.id,
  customerRef: customer.id,     // enables saved cards for this customer
  returnUrl: 'https://example.com/thank-you',   // optional — see below
});

// Pass these to your page. Never the secret key.
res.render('checkout', { sessionId: session.id, clientSecret: session.clientSecret });
```

`amountMinor` is **always** an integer in the currency's minor units. `$125.00`
is `12500`. Passing `125.00` would charge $1.25, so the SDK rejects a decimal
rather than letting it through.

`returnUrl` is **optional**. It is where 3D Secure sends the shopper back after
their bank verifies the payment; if you omit it, we return them to the page the
checkout is running on. Set it when you want them to land somewhere specific.

`clientSecret` is returned **once** — it is stored only as a hash and cannot be
fetched later. Treat it like a password: it authorises payment of that session.

---

## Browser

```html
<div id="wizpay-checkout"></div>

<script src="https://js.wizpay.ai/v1/checkout.js"></script>
<script>
  WizPayCheckout.mount({
    publishableKey: 'wzp_pk_test_…',
    sessionId: SESSION_ID,          // from your server
    clientSecret: CLIENT_SECRET,    // from your server
    selector: '#wizpay-checkout',
    onSuccess: (payment) => { window.location = '/thank-you?p=' + payment.paymentId; },
    onError:   (error)   => { console.error(error); },
  });
</script>
```

Or from npm:

```js
import { mount } from '@wizpay/checkout-sdk';
```

### Allow your domain first

The widget is **refused from any domain you have not allow-listed**. That is what
stops your publishable key — which is public — being used on someone else's site.

Add your checkout domain under **Developers → Allowed origins** in your WIZPay
dashboard. Until you do, checkout cannot be switched on.

---

## What the merchant controls

Configured per store under **Developers → Checkout**, not in code:

- **Payment methods** — cards, ACH, or both.
- **Surcharges** — set independently for card and ACH (percentage, fixed, or
  both, with an optional cap). Debit and prepaid cards are exempt by default,
  because US card network rules prohibit surcharging them.
- **Tips** — presets, custom amounts, optional preselection.
- **Card verification (3D Secure)** — automatic (recommended), always, or never.
  Verification shifts fraud-chargeback liability to the customer's bank, so
  turning it off means you carry that liability. It also does not apply outside
  the US: banks in the UK and Europe are required to verify regardless.
- **Appearance** — theme and language. Your logo and brand colour come from
  **Settings → Branding**, so checkout always matches the rest of your account.

Totals are always recalculated on our servers. The widget renders what it is
told; it never decides what you are charged.

---

## Content-Security-Policy

If your site sets a CSP, allow:

```
script-src  https://js.wizpay.ai https://js.basistheory.com
frame-src   https://*.basistheory.com
connect-src https://api.wizpay.ai https://*.basistheory.com
```

Address autocomplete needs **no Google entries** — it is proxied through the
WIZPay API, so no Google key ever reaches the browser.

---

## Webhooks

Verify before you trust, using the **raw** request body:

```js
import { WizPayCheckout } from '@wizpay/checkout-sdk/server';

app.post('/webhooks/wizpay', express.raw({ type: 'application/json' }), (req, res) => {
  if (!WizPayCheckout.verifyWebhook(req.body, req.header('x-wizpay-signature'), SIGNING_SECRET)) {
    return res.sendStatus(400);
  }
  const event = JSON.parse(req.body.toString());
  if (event.type === 'checkout.completed') fulfil(event.data);
  res.sendStatus(200);
});
```

Parse **after** verifying. Re-serializing JSON changes key order and whitespace,
and the signature will never match — the most common reason webhooks "randomly"
fail.

`checkout.completed` carries the order context, with `subtotal_minor`,
`tip_minor` and `surcharge_minor` broken out so you can post each to its own
ledger account.

---

## Licence

MIT
