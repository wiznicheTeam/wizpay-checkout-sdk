<?php
/**
 * Plugin Name:       WIZPay Checkout for WooCommerce
 * Description:       Accept cards and ACH with WIZPay. Card details are handled by a PCI-compliant vault and never touch your server.
 * Version:           0.1.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * WC requires at least: 8.0
 * Author:            WIZPay
 * License:           MIT
 * Text Domain:       wizpay-checkout
 *
 * Deliberately dependency-free: no Composer, no vendor/ directory. WordPress
 * loads every plugin into one PHP process, so two plugins shipping different
 * versions of the same library is a well-known way to break a site that has
 * nothing to do with either of them. This talks to the WIZPay REST API through
 * wp_remote_post() instead.
 */

defined( 'ABSPATH' ) || exit;

define( 'WIZPAY_CHECKOUT_VERSION', '0.1.0' );
define( 'WIZPAY_CHECKOUT_FILE', __FILE__ );
define( 'WIZPAY_CHECKOUT_PATH', plugin_dir_path( __FILE__ ) );
define( 'WIZPAY_CHECKOUT_URL', plugin_dir_url( __FILE__ ) );

/** WooCommerce is a hard requirement; say so rather than fatally erroring. */
add_action( 'plugins_loaded', 'wizpay_checkout_init', 11 );
function wizpay_checkout_init() {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'WIZPay Checkout needs WooCommerce to be installed and active.', 'wizpay-checkout' )
				. '</p></div>';
		} );
		return;
	}

	require_once WIZPAY_CHECKOUT_PATH . 'includes/class-wizpay-api.php';
	require_once WIZPAY_CHECKOUT_PATH . 'includes/class-wizpay-gateway.php';
	require_once WIZPAY_CHECKOUT_PATH . 'includes/class-wizpay-webhook.php';

	add_filter( 'woocommerce_payment_gateways', function ( $gateways ) {
		$gateways[] = 'WizPay_Gateway';
		return $gateways;
	} );

	WizPay_Webhook::register();

	// Blocks is the default checkout for new stores, and it does NOT pick up
	// gateways automatically the way the classic checkout does.
	add_action( 'woocommerce_blocks_loaded', function () {
		if ( ! class_exists( \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType::class ) ) {
			return;
		}
		require_once WIZPAY_CHECKOUT_PATH . 'includes/class-wizpay-blocks.php';
		add_action( 'woocommerce_blocks_payment_method_type_registration', function ( $registry ) {
			$registry->register( new WizPay_Blocks() );
		} );
	} );
}

/** Declare HPOS compatibility — without this WooCommerce flags the plugin as
 *  incompatible and merchants cannot enable High-Performance Order Storage. */
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
			'custom_order_tables',
			WIZPAY_CHECKOUT_FILE,
			true
		);
	}
} );

/** Settings link on the Plugins screen — the first thing anyone looks for. */
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url = admin_url( 'admin.php?page=wc-settings&tab=checkout&section=wizpay' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'wizpay-checkout' ) . '</a>' );
	return $links;
} );
