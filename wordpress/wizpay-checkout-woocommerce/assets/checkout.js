/**
 * Mounts the WIZPay widget on WooCommerce's order-pay page.
 *
 * The order is marked paid by the WEBHOOK, not here. A shopper can close the tab
 * the moment their card clears — and on a slow connection often does — so this
 * only moves them along once the payment has succeeded.
 */
(function () {
	'use strict';

	function start() {
		var data = window.wizpayCheckoutData;
		var mountPoint = document.getElementById('wizpay-checkout');
		if (!data || !mountPoint || !window.WizPayCheckout) {
			return;
		}

		window.WizPayCheckout.mount({
			publishableKey: data.publishableKey,
			sessionId: data.sessionId,
			clientSecret: data.clientSecret,
			apiBase: data.apiBase || undefined,
			selector: '#wizpay-checkout',
			onSuccess: function () {
				window.location.assign(data.returnUrl);
			},
			onError: function (error) {
				// Leave the form in place: most failures here are recoverable
				// (a declined card, a typo), and reloading would lose the order.
				if (window.console && window.console.error) {
					window.console.error('[WIZPay]', error);
				}
			},
		}).catch(function (error) {
			mountPoint.innerHTML =
				'<p>' +
				(error && error.message ? String(error.message) : 'The payment form could not be loaded.') +
				'</p>';
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
