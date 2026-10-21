<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout;

use InvalidArgumentException;

/**
 * WIZPay Checkout, server SDK.
 *
 * Creating a session is the step that fixes the amount, which is why it needs a
 * SECRET key and must happen here rather than in the browser. Everything the
 * page then does is bounded by the session you created: confirm accepts no
 * amount at all, so a tampered client payload cannot change what is charged.
 */
final class WizPayCheckout
{
    private readonly HttpClient $http;

    /**
     * @param string $secretKey `wzp_test_…` or `wzp_live_…`. Server-side only.
     * @param null|callable(string, string, string|null, array<int,string>): array{int, string} $transport
     *        Override the network call; see {@see HttpClient}.
     */
    public function __construct(
        string $secretKey,
        ?string $apiBase = null,
        ?callable $transport = null,
    ) {
        if ($secretKey === '') {
            throw new InvalidArgumentException('WIZPay: secretKey is required.');
        }
        if (!Environment::looksLikeSecretKey($secretKey)) {
            throw new InvalidArgumentException(
                'WIZPay: secretKey must be a secret key (wzp_test_… or wzp_live_…), received '
                . Environment::describeKey($secretKey) . '. A publishable key cannot create '
                . 'sessions, which is what stops a browser choosing its own price.',
            );
        }

        $this->http = new HttpClient(['x-api-key' => $secretKey], $apiBase, $transport);
    }

    /**
     * Create a checkout session. The amount is fixed HERE and is never accepted
     * from the browser again.
     *
     * The response carries `clientSecret` exactly once: it is stored only as a
     * hash, so it cannot be retrieved later. Pass it to your page alongside the
     * session id, and never log it, because together they authorise a payment.
     *
     * Order detail for interchange (lineItems, L2/L3 enhancedSchemeData, or
     * lodging for hotels) is accepted only here, never from the browser: it
     * affects your processing rate and a shopper must not be able to alter it.
     *
     * @param array<string,mixed> $input storeId, amountMinor, merchantReference,
     *        and optionally currency, customerRef, returnUrl, metadata, enhancedData.
     * @return array<string,mixed>
     */
    public function createSession(array $input): array
    {
        foreach (['storeId', 'amountMinor', 'merchantReference'] as $required) {
            if (!isset($input[$required]) || $input[$required] === '') {
                throw new InvalidArgumentException("WIZPay: {$required} is required to create a session.");
            }
        }

        $amount = $input['amountMinor'];
        if (!is_int($amount)) {
            // The single most common integration bug, and an expensive one: 10.00
            // silently becomes 10 cents, or a float rounds the wrong way.
            throw new InvalidArgumentException(
                'WIZPay: amountMinor must be an integer in minor units, received '
                . var_export($amount, true) . '. $10.00 is 1000, not 10.',
            );
        }
        if ($amount < 1) {
            throw new InvalidArgumentException('WIZPay: amountMinor must be at least 1.');
        }

        return $this->http->post('/v1/checkout/sessions', $input);
    }

    /**
     * Read a session back, server side.
     *
     * @return array<string,mixed>
     */
    public function getSession(string $sessionId): array
    {
        if ($sessionId === '') {
            throw new InvalidArgumentException('WIZPay: sessionId is required.');
        }

        return $this->http->get('/v1/checkout/sessions/' . rawurlencode($sessionId));
    }

    /**
     * Verify a webhook signature before trusting its body.
     *
     * WIZPay sends `X-Wizpay-Signature: t=<unix seconds>,v1=<hex>`, where the
     * hex is HMAC-SHA256 over `"<t>.<raw body>"`. The timestamp is INSIDE the
     * signed material, so restamping an old delivery cannot revive a replay,
     * and anything outside `$toleranceSeconds` is rejected as well.
     *
     * Verify over the RAW request bytes. Re-encoding the JSON first reorders
     * keys and drops whitespace, so the signature can never match, and that is
     * the most common reason webhooks "randomly" fail.
     *
     * @param string $rawBody         the exact bytes received, not a re-encoded array.
     * @param string $signatureHeader the full `X-Wizpay-Signature` header value.
     * @param int    $toleranceSeconds max clock skew to accept; 0 disables the check.
     */
    public static function verifyWebhook(
        string $rawBody,
        string $signatureHeader,
        string $signingSecret,
        int $toleranceSeconds = 300,
    ): bool {
        if ($signatureHeader === '' || $signingSecret === '') {
            return false;
        }

        $timestamp = '';
        $signature = '';
        foreach (explode(',', $signatureHeader) as $part) {
            $eq = strpos($part, '=');
            if ($eq === false) {
                continue;
            }
            $key = trim(substr($part, 0, $eq));
            $value = trim(substr($part, $eq + 1));
            if ($key === 't') {
                $timestamp = $value;
            } elseif ($key === 'v1') {
                $signature = $value;
            }
        }

        if ($timestamp === '' || $signature === '' || !ctype_digit($timestamp)) {
            return false;
        }

        if ($toleranceSeconds > 0 && abs(time() - (int) $timestamp) > $toleranceSeconds) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $signingSecret);

        // Constant time, so a wrong signature cannot be discovered one byte at a
        // time by measuring how long the comparison takes.
        return hash_equals($expected, $signature);
    }

    /**
     * Verify a webhook and decode it in one step.
     *
     * @return array<string,mixed>
     * @throws WizPayError when the signature does not verify.
     */
    public static function parseWebhook(
        string $rawBody,
        string $signatureHeader,
        string $signingSecret,
        int $toleranceSeconds = 300,
    ): array {
        if (!self::verifyWebhook($rawBody, $signatureHeader, $signingSecret, $toleranceSeconds)) {
            throw new WizPayError('WIZPay: webhook signature did not verify.', 401);
        }

        try {
            $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new WizPayError('WIZPay: webhook body was not valid JSON.', 400);
        }

        return is_array($decoded) ? $decoded : [];
    }
}
