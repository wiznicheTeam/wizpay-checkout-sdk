=== WIZPay Checkout for WooCommerce ===
Contributors: wizpay
Tags: woocommerce, payment gateway, credit card, ach, payments
Requires at least: 6.2
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.0
License: MIT

Accept cards and ACH with WIZPay. Card details never touch your server.

== Description ==

Card fields are hosted by a PCI-compliant vault, so card data goes from your
customer's browser straight to the vault and never through your site. That keeps
your store in PCI **SAQ-A** rather than SAQ-D.

* Cards and ACH / bank transfer
* Surcharges and tips, configured per store in your WIZPay dashboard
* Saved cards for returning customers
* 3D Secure, verified in-page rather than by sending customers to their bank
* Refunds from the normal WooCommerce order screen
* Works with both the classic and the block-based checkout

The plugin has **no Composer dependencies**. WordPress loads every plugin into
one PHP process, and two plugins shipping different versions of the same library
is a well-known way to break a site that has nothing to do with either of them.

== Installation ==

1. Install and activate the plugin.
2. Go to **WooCommerce → Settings → Payments → WIZPay**.
3. Enter your **Store ID**, **publishable key** and **secret key** from
   **Developers → Checkout** in your WIZPay dashboard.
4. Copy the webhook URL shown in the settings into **Developers → Webhooks**,
   subscribed to `checkout.completed`, and paste the signing secret back.
5. **Allow-list your domain** under **Developers → Allowed origins**. The
   checkout is refused from any domain you have not listed — that is what stops
   your publishable key being used on someone else's site.

Leave **Test mode** on until you have taken a test payment. Going live is a
matter of switching it off: the live keys are separate fields, so nothing else
changes.

== Frequently Asked Questions ==

= Does card data touch my server? =

No. The card fields are iframes served by the vault. Your server never sees a
card number, which is the point.

= What happens if a customer closes the tab after paying? =

The order still completes. Orders are marked paid by a webhook from WIZPay, not
by the customer's browser getting back to your site.

= Should I turn 3D Secure off to reduce friction? =

Only knowingly. Verification shifts liability for fraudulent chargebacks to the
customer's bank; without it, that loss is yours. It also does not apply outside
the US — banks in the UK and Europe are required to verify regardless. The
setting lives in your WIZPay dashboard.

= Why does payment happen on a separate page? =

So the amount cannot drift. The session is created once the order exists and its
total is final, rather than while the customer can still change the cart.

== Changelog ==

= 0.1.0 =
* First release.
