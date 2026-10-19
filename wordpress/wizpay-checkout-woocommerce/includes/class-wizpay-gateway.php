<?php
/**
 * WIZPay payment gateway.
 *
 * Flow: `process_payment` creates the session and redirects to WooCommerce's own
 * order-pay page, where the widget renders.
 *
 * That redirect is deliberate. Creating the session at checkout-render time
 * would pin an amount the shopper can still change — add a coupon, alter
 * shipping — and the session amount is immutable by design. By the order-pay
 * page the order exists and its total is final, so the amount the widget shows
 * and the amount charged cannot drift apart.
 */

defined( 'ABSPATH' ) || exit;

class WizPay_Gateway extends WC_Payment_Gateway {

	public function __construct() {
		$this->id                 = 'wizpay';
		$this->method_title       = __( 'WIZPay', 'wizpay-checkout' );
		$this->method_description = __( 'Accept cards and ACH with WIZPay. Card details are handled by a PCI-compliant vault and never reach your server.', 'wizpay-checkout' );
		$this->has_fields         = false;
		$this->supports           = array( 'products', 'refunds' );

		$this->init_form_fields();
		$this->init_settings();

		$this->title       = $this->get_option( 'title', __( 'Card or bank transfer', 'wizpay-checkout' ) );
		$this->description = $this->get_option( 'description' );
		$this->enabled     = $this->get_option( 'enabled' );

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		add_action( 'woocommerce_receipt_' . $this->id, array( $this, 'render_widget' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue' ) );
		add_action( 'woocommerce_thankyou_' . $this->id, array( $this, 'confirm_on_return' ) );
	}

	public function init_form_fields() {
		$this->form_fields = array(
			'enabled'     => array(
				'title'   => __( 'Enable', 'wizpay-checkout' ),
				'type'    => 'checkbox',
				'label'   => __( 'Accept payments with WIZPay', 'wizpay-checkout' ),
				'default' => 'no',
			),
			'title'       => array(
				'title'       => __( 'Title', 'wizpay-checkout' ),
				'type'        => 'text',
				'description' => __( 'What customers see at checkout.', 'wizpay-checkout' ),
				'default'     => __( 'Card or bank transfer', 'wizpay-checkout' ),
				'desc_tip'    => true,
			),
			'description' => array(
				'title'   => __( 'Description', 'wizpay-checkout' ),
				'type'    => 'textarea',
				'default' => '',
			),
			'store_id'    => array(
				'title'       => __( 'Store ID', 'wizpay-checkout' ),
				'type'        => 'text',
				'description' => __( 'From Developers → Checkout in your WIZPay dashboard.', 'wizpay-checkout' ),
				'desc_tip'    => true,
			),
			'testmode'    => array(
				'title'       => __( 'Test mode', 'wizpay-checkout' ),
				'type'        => 'checkbox',
				'label'       => __( 'Use test keys', 'wizpay-checkout' ),
				'description' => __( 'Test payments never move real money. Switching to live is a matter of using your live keys below.', 'wizpay-checkout' ),
				'default'     => 'yes',
			),
			'test_publishable_key' => array(
				'title'       => __( 'Test publishable key', 'wizpay-checkout' ),
				'type'        => 'text',
				'description' => __( 'Starts wzp_pk_test_. Safe to be public — it appears in your page source.', 'wizpay-checkout' ),
				'desc_tip'    => true,
			),
			'test_secret_key' => array(
				'title'       => __( 'Test secret key', 'wizpay-checkout' ),
				'type'        => 'password',
				'description' => __( 'Starts wzp_test_. Never shown to customers.', 'wizpay-checkout' ),
				'desc_tip'    => true,
			),
			'live_publishable_key' => array(
				'title'    => __( 'Live publishable key', 'wizpay-checkout' ),
				'type'     => 'text',
				'desc_tip' => true,
				'description' => __( 'Starts wzp_pk_live_.', 'wizpay-checkout' ),
			),
			'live_secret_key' => array(
				'title'    => __( 'Live secret key', 'wizpay-checkout' ),
				'type'     => 'password',
				'desc_tip' => true,
				'description' => __( 'Starts wzp_live_. Never shown to customers.', 'wizpay-checkout' ),
			),
			'webhook_secret' => array(
				'title'       => __( 'Webhook signing secret', 'wizpay-checkout' ),
				'type'        => 'password',
				/* translators: %s: webhook URL */
				'description' => sprintf(
					__( 'Add this endpoint in Developers → Webhooks, subscribed to checkout.completed: %s', 'wizpay-checkout' ),
					'<code>' . esc_html( WizPay_Webhook::url() ) . '</code>'
				),
			),
			'api_base'   => array(
				'title'       => __( 'API base URL', 'wizpay-checkout' ),
				'type'        => 'text',
				'default'     => 'https://api.wizpay.ai',
				'description' => __( 'Leave as-is unless WIZPay asked you to change it.', 'wizpay-checkout' ),
				'desc_tip'    => true,
			),
		);
	}

	public function is_test() {
		return 'yes' === $this->get_option( 'testmode', 'yes' );
	}

	public function publishable_key() {
		return $this->get_option( $this->is_test() ? 'test_publishable_key' : 'live_publishable_key' );
	}

	private function secret_key() {
		return $this->get_option( $this->is_test() ? 'test_secret_key' : 'live_secret_key' );
	}

	private function api() {
		return new WizPay_API( $this->secret_key(), $this->get_option( 'api_base' ) );
	}

	/** Hide the gateway until it can actually take a payment. */
	public function is_available() {
		if ( 'yes' !== $this->enabled ) {
			return false;
		}
		return $this->publishable_key() && $this->secret_key() && $this->get_option( 'store_id' );
	}

	/**
	 * Create the session and send the customer to the order-pay page.
	 *
	 * @param int $order_id
	 * @return array
	 */
	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );

		$session = $this->api()->create_session( array(
			'storeId'           => $this->get_option( 'store_id' ),
			'amountMinor'       => WizPay_API::to_minor( $order->get_total(), $order->get_currency() ),
			'currency'          => $order->get_currency(),
			'merchantReference' => (string) $order->get_order_number(),
			// Lets a returning customer reuse a saved card. Guests get no
			// customer ref, and so no saved cards — which is correct.
			'customerRef'       => $order->get_customer_id() ? 'wc_' . $order->get_customer_id() : null,
			'returnUrl'         => $this->return_url( $order ),
			'metadata'          => array(
				'woocommerce_order_id' => (string) $order_id,
				'site_url'             => home_url(),
			),
			'enhancedData'      => $this->line_items( $order ),
		) );

		if ( is_wp_error( $session ) ) {
			wc_add_notice( $session->get_error_message(), 'error' );
			$order->add_order_note( sprintf( __( 'WIZPay: could not start the payment. %s', 'wizpay-checkout' ), $session->get_error_message() ) );
			return array( 'result' => 'failure' );
		}

		// The client secret authorises payment of this session, so it is stored
		// on the order (private meta) and handed to the page from there — never
		// placed in a URL, where it would land in logs, history and Referer headers.
		$order->update_meta_data( '_wizpay_session_id', $session['id'] );
		$order->update_meta_data( '_wizpay_client_secret', $session['clientSecret'] );
		$order->save();

		return array(
			'result'   => 'success',
			'redirect' => $order->get_checkout_payment_url( true ),
		);
	}

	/** Order lines for interchange optimisation. Optional, and never fatal. */
	private function line_items( $order ) {
		$items = array();
		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			$items[] = array(
				'description' => wp_strip_all_tags( $item->get_name() ),
				'productCode' => $product ? (string) ( $product->get_sku() ?: $product->get_id() ) : '',
				'quantity'    => max( 1, (int) $item->get_quantity() ),
				'unitPrice'   => WizPay_API::to_minor( $item->get_subtotal() / max( 1, $item->get_quantity() ), $order->get_currency() ),
				'taxAmount'   => WizPay_API::to_minor( $item->get_total_tax(), $order->get_currency() ),
				'totalAmount' => WizPay_API::to_minor( $item->get_total() + $item->get_total_tax(), $order->get_currency() ),
				'unitOfMeasure' => 'EA',
			);
		}
		return $items ? array( 'lineItems' => $items ) : null;
	}

	private function return_url( $order ) {
		return add_query_arg( 'wizpay_order', $order->get_id(), $this->get_return_url( $order ) );
	}

	public function maybe_enqueue() {
		if ( ! is_wc_endpoint_url( 'order-pay' ) ) {
			return;
		}
		wp_enqueue_script(
			'wizpay-checkout-sdk',
			'https://js.wizpay.ai/v1/checkout.js',
			array(),
			null,
			true
		);
		wp_enqueue_script(
			'wizpay-checkout-woo',
			WIZPAY_CHECKOUT_URL . 'assets/checkout.js',
			array( 'wizpay-checkout-sdk' ),
			WIZPAY_CHECKOUT_VERSION,
			true
		);
	}

	/** Render the widget on the order-pay page. */
	public function render_widget( $order_id ) {
		$order = wc_get_order( $order_id );
		$session_id = $order->get_meta( '_wizpay_session_id' );
		$client_secret = $order->get_meta( '_wizpay_client_secret' );

		if ( ! $session_id || ! $client_secret ) {
			echo '<p>' . esc_html__( 'This payment could not be started. Please try placing the order again.', 'wizpay-checkout' ) . '</p>';
			return;
		}

		wp_localize_script( 'wizpay-checkout-woo', 'wizpayCheckoutData', array(
			'publishableKey' => $this->publishable_key(),
			'sessionId'      => $session_id,
			'clientSecret'   => $client_secret,
			'apiBase'        => $this->get_option( 'api_base' ),
			'returnUrl'      => $this->return_url( $order ),
			'orderId'        => (string) $order_id,
		) );

		echo '<div id="wizpay-checkout"></div>';
	}

	/**
	 * Confirm the payment when the shopper lands on the thank-you page.
	 *
	 * The webhook is still the source of truth, but it can arrive a second or
	 * two behind the shopper, and "pending" on a thank-you page after a
	 * successful payment reliably generates a support ticket. This asks WIZPay
	 * directly rather than trusting anything the browser said.
	 */
	public function confirm_on_return( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || $order->is_paid() ) {
			return;
		}

		$session_id = $order->get_meta( '_wizpay_session_id' );
		if ( ! $session_id ) {
			return;
		}

		$session = $this->api()->get_session( $session_id );
		if ( is_wp_error( $session ) || empty( $session['status'] ) ) {
			return; // Leave it to the webhook.
		}

		if ( 'succeeded' === $session['status'] ) {
			WizPay_Webhook::mark_paid( $order, array(
				'payment_id'      => isset( $session['paymentId'] ) ? $session['paymentId'] : '',
				'tip_minor'       => isset( $session['pricing']['tipMinor'] ) ? $session['pricing']['tipMinor'] : 0,
				'surcharge_minor' => isset( $session['pricing']['surchargeMinor'] ) ? $session['pricing']['surchargeMinor'] : 0,
			) );
		}
	}

	/**
	 * Refund through WIZPay.
	 *
	 * @return bool|WP_Error
	 */
	public function process_refund( $order_id, $amount = null, $reason = '' ) {
		$order      = wc_get_order( $order_id );
		$payment_id = $order->get_transaction_id();

		if ( ! $payment_id ) {
			return new WP_Error( 'wizpay_no_payment', __( 'This order has no WIZPay payment to refund.', 'wizpay-checkout' ) );
		}

		$result = $this->api()->refund( array(
			'paymentId'         => $payment_id,
			'amountMinor'       => WizPay_API::to_minor( $amount ?: $order->get_total(), $order->get_currency() ),
			'currency'          => $order->get_currency(),
			'merchantReference' => (string) $order->get_order_number(),
			'reason'            => $reason,
		) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$order->add_order_note( sprintf(
			/* translators: 1: amount, 2: reason */
			__( 'WIZPay refund of %1$s submitted. %2$s', 'wizpay-checkout' ),
			wc_price( $amount ),
			$reason
		) );
		return true;
	}
}
