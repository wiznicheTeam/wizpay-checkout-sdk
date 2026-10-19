/**
 * Registers WIZPay on the WooCommerce Blocks checkout.
 *
 * Only a label and description: the card fields live on the order-pay page, so
 * there is nothing to render inline here. Written against the global wc/wp
 * objects rather than a build step, so the plugin ships without a bundler.
 */
(function (registry, element, htmlEntities) {
	'use strict';

	if (!registry || !registry.registerPaymentMethod) {
		return;
	}

	var settings = (window.wc && window.wc.wcSettings
		? window.wc.wcSettings.getSetting('wizpay_data', {})
		: {});

	var title = htmlEntities.decodeEntities(settings.title || 'WIZPay');
	var description = htmlEntities.decodeEntities(settings.description || '');

	function Label() {
		return element.createElement(
			'span',
			{ style: { display: 'flex', alignItems: 'center', gap: '8px' } },
			title,
			settings.testMode
				? element.createElement(
						'span',
						{
							style: {
								padding: '1px 6px',
								borderRadius: '999px',
								background: '#fff3cd',
								color: '#8a6100',
								fontSize: '11px',
								fontWeight: 700,
								textTransform: 'uppercase',
							},
						},
						'Test mode'
				  )
				: null
		);
	}

	registry.registerPaymentMethod({
		name: 'wizpay',
		label: element.createElement(Label, null),
		ariaLabel: title,
		content: element.createElement('div', null, description),
		edit: element.createElement('div', null, description),
		canMakePayment: function () {
			return true;
		},
		supports: {
			features: settings.supports || ['products'],
		},
	});
})(window.wc && window.wc.wcBlocksRegistry, window.wp && window.wp.element, window.wp && window.wp.htmlEntities);
