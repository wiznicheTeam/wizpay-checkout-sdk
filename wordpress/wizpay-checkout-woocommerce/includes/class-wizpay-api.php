<?php
/**
 * Thin WIZPay REST client built on wp_remote_post().
 *
 * The secret key is used HERE and only here — never enqueued, never printed into
 * a page, never passed to JavaScript. Only the publishable key reaches the
 * browser, and that one is public by design.
 */

defined( 'ABSPATH' ) || exit;

class WizPay_API {

	/** @var string */
	private $secret_key;

	/** @var string */
	private $api_base;

	public function __construct( $secret_key, $api_base = '' ) {
		$this->secret_key = (string) $secret_key;
		$this->api_base   = untrailingslashit( $api_base ?: 'https://api.wizpay.ai' );
	}

	/**
	 * Create a checkout session. This is the call that fixes the amount, which is
	 * why it runs on the server with a secret key and never in the browser.
	 *
	 * @return array|WP_Error
	 */
	public function create_session( array $body ) {
		return $this->request( 'POST', '/v1/checkout/sessions', $body );
	}

	/**
	 * Read a session's outcome. Lets the thank-you page confirm the payment
	 * instead of waiting for a webhook that may be seconds behind the shopper.
	 *
	 * @return array|WP_Error
	 */
	public function get_session( $session_id ) {
		return $this->request( 'GET', '/v1/checkout/sessions/' . rawurlencode( $session_id ) );
	}

	/** @return array|WP_Error */
	public function refund( array $body ) {
		return $this->request( 'POST', '/v1/payments/refunds', $body, true );
	}

	/**
	 * @param bool $idempotent Send an Idempotency-Key. Required by the API for
	 *                         anything that moves money, so a retried request
	 *                         after a timeout cannot refund twice.
	 * @return array|WP_Error
	 */
	private function request( $method, $path, array $body = array(), $idempotent = false ) {
		if ( '' === $this->secret_key ) {
			return new WP_Error( 'wizpay_no_key', __( 'WIZPay is not configured: add your secret key in the gateway settings.', 'wizpay-checkout' ) );
		}

		$headers = array(
			'Content-Type' => 'application/json',
			'x-api-key'    => $this->secret_key,
			'User-Agent'   => 'wizpay-woocommerce/' . WIZPAY_CHECKOUT_VERSION,
		);
		if ( $idempotent ) {
			$headers['Idempotency-Key'] = wp_generate_uuid4();
		}

		$response = wp_remote_request(
			$this->api_base . $path,
			array(
				'method'  => $method,
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 30,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = wp_remote_retrieve_body( $response );
		$parsed = json_decode( $raw, true );

		if ( $status >= 400 ) {
			// Surface the API's own message: "Checkout is not enabled for this
			// store" is actionable, "HTTP 403" sends the merchant to support.
			$message = is_array( $parsed ) && ! empty( $parsed['message'] )
				? $parsed['message']
				: sprintf( __( 'WIZPay request failed (HTTP %d).', 'wizpay-checkout' ), $status );

			return new WP_Error( 'wizpay_api_error', $message, array( 'status' => $status ) );
		}

		return is_array( $parsed ) ? $parsed : array();
	}

	/**
	 * Verify a webhook signature over the RAW body.
	 *
	 * Never re-encode the JSON first: that reorders keys and drops whitespace, so
	 * the signature can never match. It is the most common reason webhooks
	 * "randomly" fail.
	 */
	public static function verify_webhook( $raw_body, $signature, $signing_secret ) {
		if ( '' === (string) $signature || '' === (string) $signing_secret ) {
			return false;
		}
		$expected = hash_hmac( 'sha256', $raw_body, $signing_secret );
		return hash_equals( $expected, trim( (string) $signature ) );
	}

	/** Minor units for a WooCommerce amount, respecting the currency's decimals. */
	public static function to_minor( $amount, $currency ) {
		$decimals = 2;
		if ( function_exists( 'wc_get_price_decimals' ) ) {
			$decimals = (int) wc_get_price_decimals();
		}
		// Zero-decimal currencies (JPY) would otherwise be inflated 100x.
		$zero_decimal = array( 'JPY', 'KRW', 'VND', 'CLP', 'ISK' );
		if ( in_array( strtoupper( (string) $currency ), $zero_decimal, true ) ) {
			$decimals = 0;
		}
		return (int) round( (float) $amount * pow( 10, $decimals ) );
	}
}
