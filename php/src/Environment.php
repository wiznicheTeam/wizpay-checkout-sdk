<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout;

/**
 * Test and live mode.
 *
 * WIZPay works like Stripe: ONE API serves both, and the key decides which.
 * `wzp_test_…` sees test data and never moves real money; `wzp_live_…` does.
 * There is no separate test host and no mode flag to pass, so switching is
 * swapping one key in one place, which is the only version of this people get
 * right.
 *
 * `apiBase` is a separate axis: it points the SDK at a WIZPay DEPLOYMENT (your
 * own develop environment, say). Most integrations never set it.
 */
final class Environment
{
    /** Production WIZPay. Override via `apiBase` to target another deployment. */
    public const DEFAULT_API_BASE = 'https://api.wizpay.ai';

    private const PUBLISHABLE = '/^wzp_pk_(test|live)_[A-Za-z0-9_-]{43}$/';
    private const SECRET = '/^wzp_(test|live)_/';

    /** True when `$key` is a well-formed publishable key. */
    public static function isPublishableKey(string $key): bool
    {
        return preg_match(self::PUBLISHABLE, $key) === 1;
    }

    /**
     * True when `$key` looks like a SECRET key.
     *
     * Worth detecting explicitly rather than rejecting as malformed: a
     * publishable key here means the caller expected it to create sessions, and
     * they need to be told why it cannot rather than "invalid key".
     */
    public static function looksLikeSecretKey(string $key): bool
    {
        return preg_match(self::SECRET, $key) === 1 && !str_starts_with($key, 'wzp_pk_');
    }

    /** Normalize an API base URL (no trailing slash). */
    public static function normalizeApiBase(?string $base): string
    {
        return rtrim($base ?? self::DEFAULT_API_BASE, '/');
    }

    /** A safe description of a bad key for an error message, never the whole value. */
    public static function describeKey(string $key): string
    {
        if ($key === '') {
            return 'an empty string';
        }

        return '"' . substr($key, 0, 11) . '…"';
    }
}
