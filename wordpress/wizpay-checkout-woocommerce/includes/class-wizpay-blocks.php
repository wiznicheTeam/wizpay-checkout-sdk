<?php
/**
 * WooCommerce Blocks (the React checkout) support.
 *
 * Without this the gateway simply does not appear on a block-based checkout —
 * which is the default for every store created in recent WooCommerce versions.
 * The classic shortcode checkout picks gateways up automatically; blocks does not.
 *
 * There are no inline card fields to register: payment happens on the order-pay
 * page, so blocks only needs the method's label and description.
 */

defined( 'ABSPATH' ) || exit;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

final class WizPay_Blocks extends AbstractPaymentMethodType {

	protected $name = 'wizpay';

	/** @var WizPay_Gateway|null */
	private $gateway;

	public function initialize() {
		$this->settings = get_option( 'woocommerce_wizpay_settings', array() );
		$gateways       = WC()->payment_gateways() ? WC()->payment_gateways()->payment_gateways() : array();
		$this->gateway  = isset( $gateways['wizpay'] ) ? $gateways['wizpay'] : null;
	}

	public function is_active() {
		return $this->gateway ? $this->gateway->is_available() : false;
	}

	public function get_payment_method_script_handles() {
		wp_register_script(
			'wizpay-blocks',
			WIZPAY_CHECKOUT_URL . 'assets/blocks.js',
			array( 'wc-blocks-registry', 'wp-element', 'wp-html-entities' ),
			WIZPAY_CHECKOUT_VERSION,
			true
		);
		return array( 'wizpay-blocks' );
	}

	public function get_payment_method_data() {
		return array(
			'title'       => $this->gateway ? $this->gateway->get_title() : __( 'WIZPay', 'wizpay-checkout' ),
			'description' => $this->gateway ? $this->gateway->get_description() : '',
			// Shown next to the method name so a merchant testing in production
			// notices immediately that no real money is moving.
			'testMode'    => $this->gateway ? $this->gateway->is_test() : false,
			'supports'    => $this->gateway ? array_filter( $this->gateway->supports, array( $this->gateway, 'supports' ) ) : array(),
		);
	}
}
