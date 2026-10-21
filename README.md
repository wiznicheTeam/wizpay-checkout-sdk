# WIZPay Checkout SDK

Take card and ACH payments on your own website. Card fields are hosted by
[Basis Theory](https://basistheory.com), so **card data never touches your
servers** and your integration stays in PCI **SAQ-A** rather than SAQ-D.

```
npm install @wizniche/wizpay-checkout-sdk
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
import { WizPayCheckout } from '@wizniche/wizpay-checkout-sdk/server';

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
import { mount } from '@wizniche/wizpay-checkout-sdk';
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

### Using your own pay button

Hide ours and drive the payment from your own UI. The amount still comes from
the session, so your button cannot change what is charged any more than ours
can.

```js
const checkout = await WizPayCheckout.mount({
  publishableKey, sessionId, clientSecret,
  selector: '#wizpay-checkout',
  hidePayButton: true,
  onReadyChange: ({ ready, busy }) => {
    myButton.disabled = !ready || busy;
    myButton.textContent = busy ? 'Processing…' : 'Place order';
  },
  onSuccess: (payment) => { window.location = '/thank-you'; },
});

myButton.addEventListener('click', () => checkout.submit());
```

`submit()` rejects if the form is not complete, so `onReadyChange` is the
signal to mirror, not something to re-derive.

Address autocomplete needs **no Google entries** — it is proxied through the
WIZPay API, so no Google key ever reaches the browser.

---

## Webhooks

Verify before you trust, using the **raw** request body:

```js
import { WizPayCheckout } from '@wizniche/wizpay-checkout-sdk/server';

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

### The signature scheme

If you verify by hand rather than with an SDK, the header looks like this:

```
X-Wizpay-Signature: t=1761004800,v1=9f86d0818...
```

`v1` is HMAC-SHA256 of `"<t>.<raw body>"`, hex encoded, keyed by your endpoint
signing secret. The timestamp is inside the signed material, so it cannot be
altered to make an old delivery look fresh. Reject anything whose `t` is more
than five minutes from your own clock, and compare in constant time. Both SDKs
do all of this for you, including the freshness window.

`checkout.completed` carries the order context, with `subtotal_minor`,
`tip_minor` and `surcharge_minor` broken out so you can post each to its own
ledger account.

---

## PHP (server)

```
composer require wizniche/wizpay-checkout-sdk
```

```php
use Wizniche\WizpayCheckout\WizPayCheckout;

$wizpay = new WizPayCheckout(getenv('WIZPAY_SECRET_KEY'));

$session = $wizpay->createSession([
    'storeId'           => 'b96d7eec-...',
    'amountMinor'       => 4200,            // $42.00, never 42.00
    'merchantReference' => 'ORD-1001',
    'customerRef'       => 'customer-42',   // required for saved cards
]);

// Hand these two to your page. Never log them together: they authorise a payment.
echo json_encode(['sessionId' => $session['id'], 'clientSecret' => $session['clientSecret']]);
```

Verifying a webhook, over the RAW body:

```php
$raw    = file_get_contents('php://input');
$header = $_SERVER['HTTP_X_WIZPAY_SIGNATURE'] ?? '';

try {
    $event = WizPayCheckout::parseWebhook($raw, $header, getenv('WIZPAY_SIGNING_SECRET'));
} catch (\Wizniche\WizpayCheckout\WizPayError $e) {
    http_response_code(400);
    exit;
}

if ($event['type'] === 'checkout.completed') {
    fulfil($event['data']);
}
http_response_code(200);
```

`parseWebhook` verifies and decodes in one step and throws rather than handing
back an unverified event. Use `verifyWebhook` if you want the boolean.

The package requires no third-party dependencies: it uses ext-curl and
ext-json, which any PHP serving a checkout already has. A payments SDK on a
merchant's server is a supply-chain surface, so it adds nothing to it. If you
standardise on your own HTTP client, pass a transport callable as the third
constructor argument and the SDK will use it.

---

## WooCommerce

A WooCommerce gateway lives in `wordpress/wizpay-checkout-woocommerce/`. It has
**no Composer dependencies** — WordPress loads every plugin into one PHP
process, and two plugins shipping different versions of the same library is a
well-known way to break a site that has nothing to do with either of them. It
talks to the REST API through `wp_remote_post()` instead.

Payment happens on WooCommerce's order-pay page rather than inline at checkout,
so the session is created once the order total is final and the amount cannot
drift while the customer edits their cart.

Orders are marked paid by the **webhook**, not by the browser — a customer who
closes the tab the moment their card clears still gets their order.

## Licence

MIT
