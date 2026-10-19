<?php
/**
 * Inbound WIZPay webhooks.
 *
 * The webhook — not the browser — is what marks an order paid. A shopper can
 * close the tab the instant their card clears, and on a slow connection often
 * does; relying on them making it back to the return URL loses real orders. The
 * browser redirect is a convenience, the webhook is the source of truth.
 */

defined( 'ABSPATH' ) || exit;

class WizPay_Webhook {

	const ROUTE = 'wizpay/v1';

	public static function register() {
		add_action( 'rest_api_init', function () {
			register_rest_route( self::ROUTE, '/webhook', array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle' ),
				// Authentication IS the signature check below; a webhook has no
				// WordPress user. Returning true here and verifying the HMAC is
				// the correct pattern, not an open endpoint.
				'permission_callback' => '__return_true',
			) );
		} );
	}

	public static function url() {
		return rest_url( self::ROUTE . '/webhook' );
	}

	public static function handle( WP_REST_Request $request ) {
		$settings = get_option( 'woocommerce_wizpay_settings', array() );
		$secret   = isset( $settings['webhook_secret'] ) ? $settings['webhook_secret'] : '';

		// Verify over the RAW body. Re-encoding the JSON first reorders keys and
		// drops whitespace, so the signature could never match.
		$raw       = $request->get_body();
		$signature = $request->get_header( 'x-wizpay-signature' );

		if ( ! WizPay_API::verify_webhook( $raw, $signature, $secret ) ) {
			return new WP_REST_Response( array( 'error' => 'invalid signature' ), 400 );
		}

		$event = json_decode( $raw, true );
		$type  = isset( $event['type'] ) ? $event['type'] : '';
		$data  = isset( $event['data'] ) ? $event['data'] : array();

		if ( 'checkout.completed' !== $type ) {
			// Acknowledge anything else: a non-2xx makes WIZPay retry an event we
			// are simply not interested in, and repeated failures disable the
			// endpoint for the events we DO care about.
			return new WP_REST_Response( array( 'ignored' => $type ), 200 );
		}

		$order = self::resolve_order( $data );
		if ( ! $order ) {
			// Also a 200: the event is probably for another site sharing the
			// WIZPay account. Retrying would never find the order here.
			return new WP_REST_Response( array( 'ignored' => 'unknown order' ), 200 );
		}

		self::mark_paid( $order, $data );
		return new WP_REST_Response( array( 'received' => true ), 200 );
	}

	/** Prefer our own metadata, fall back to the merchant reference. */
	private static function resolve_order( array $data ) {
		$meta = isset( $data['metadata'] ) && is_array( $data['metadata'] ) ? $data['metadata'] : array();

		if ( ! empty( $meta['woocommerce_order_id'] ) ) {
			$order = wc_get_order( (int) $meta['woocommerce_order_id'] );
			if ( $order ) {
				return $order;
			}
		}
		if ( ! empty( $data['merchant_reference'] ) ) {
			$orders = wc_get_orders( array(
				'limit'          => 1,
				'transaction_id' => '',
				'meta_key'       => '_wizpay_session_id',
				'meta_value'     => isset( $data['session_id'] ) ? $data['session_id'] : '',
			) );
			if ( ! empty( $orders ) ) {
				return $orders[0];
			}
		}
		return null;
	}

	/**
	 * Complete the order, exactly once.
	 *
	 * The return page and the webhook routinely race, and the webhook can be
	 * redelivered, so this has to be safe to run repeatedly.
	 */
	public static function mark_paid( $order, array $data ) {
		if ( $order->is_paid() ) {
			return;
		}

		$payment_id = isset( $data['payment_id'] ) ? $data['payment_id'] : '';
		if ( $payment_id ) {
			$order->set_transaction_id( $payment_id );
		}

		$tip       = isset( $data['tip_minor'] ) ? (int) $data['tip_minor'] : 0;
		$surcharge = isset( $data['surcharge_minor'] ) ? (int) $data['surcharge_minor'] : 0;

		$note = __( 'Paid with WIZPay.', 'wizpay-checkout' );
		if ( $tip || $surcharge ) {
			// Record these on the order: a merchant reconciling a payout against
			// the order total needs to see why they differ.
			$note .= ' ' . sprintf(
				/* translators: 1: tip, 2: surcharge */
				__( 'Includes tip %1$s and surcharge %2$s.', 'wizpay-checkout' ),
				wc_price( $tip / 100 ),
				wc_price( $surcharge / 100 )
			);
			$order->update_meta_data( '_wizpay_tip_minor', $tip );
			$order->update_meta_data( '_wizpay_surcharge_minor', $surcharge );
		}

		$order->add_order_note( $note );
		$order->payment_complete( $payment_id );

		// The client secret authorises payment of this session; once the payment
		// is done it has no further use, so do not keep it on the order.
		$order->delete_meta_data( '_wizpay_client_secret' );
		$order->save();
	}
}
