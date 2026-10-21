<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Wizniche\WizpayCheckout\WizPayCheckout;
use Wizniche\WizpayCheckout\WizPayError;

/**
 * The signature scheme, pinned against the API's OWN signer.
 *
 * The golden vector below was produced by wizpay-api's
 * src/developer/webhook-secret.util.ts. Hard-coding its real output is the
 * point: an earlier version of the Node SDK and the WooCommerce plugin both
 * hashed the body ALONE and compared it against the whole `t=…,v1=…` header.
 * Their tests defined a matching sign() helper, so they agreed with the code
 * and never with the wire, and every genuine delivery would have been rejected.
 */
final class WebhookVerificationTest extends TestCase
{
    private const SECRET = 'whsec_golden_vector_fixture';
    private const BODY = '{"type":"checkout.completed","data":{"total_minor":12360}}';
    private const T = 1761004800;
    private const V1 = '8a78e91b8ed12949c89fbb27fea0d0afba180bba49a8ee5dddaf6dfcaf6b7584';

    /** The vector is fixed in the past, so freshness has to be off to check it. */
    private const NO_TTL = 0;

    private static function header(int $t, string $v1): string
    {
        return "t={$t},v1={$v1}";
    }

    private static function sign(int $t, string $body, string $secret = self::SECRET): string
    {
        return hash_hmac('sha256', $t . '.' . $body, $secret);
    }

    private static function fresh(string $body, string $secret = self::SECRET): string
    {
        $t = time();

        return self::header($t, self::sign($t, $body, $secret));
    }

    public function test_accepts_the_signature_the_api_actually_produces(): void
    {
        $this->assertTrue(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::header(self::T, self::V1),
            self::SECRET,
            self::NO_TTL,
        ));
    }

    public function test_signs_over_timestamp_dot_body_not_the_body_alone(): void
    {
        // The old, broken scheme. If this ever passes again, the bug is back.
        $bodyOnly = hash_hmac('sha256', self::BODY, self::SECRET);

        $this->assertFalse(WizPayCheckout::verifyWebhook(self::BODY, $bodyOnly, self::SECRET, self::NO_TTL));
        $this->assertFalse(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::header(self::T, $bodyOnly),
            self::SECRET,
            self::NO_TTL,
        ));
    }

    public function test_rejects_a_tampered_body(): void
    {
        $tampered = str_replace('12360', '1', self::BODY);

        $this->assertFalse(WizPayCheckout::verifyWebhook($tampered, self::fresh(self::BODY), self::SECRET));
    }

    public function test_rejects_a_signature_made_with_a_different_secret(): void
    {
        $this->assertFalse(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::fresh(self::BODY, 'whsec_other'),
            self::SECRET,
        ));
    }

    public function test_rejects_a_replay_outside_the_freshness_window(): void
    {
        $old = time() - 600;

        $this->assertFalse(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::header($old, self::sign($old, self::BODY)),
            self::SECRET,
        ));
    }

    public function test_accepts_a_delivery_inside_the_freshness_window(): void
    {
        $recent = time() - 60;

        $this->assertTrue(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::header($recent, self::sign($recent, self::BODY)),
            self::SECRET,
        ));
    }

    public function test_a_fresh_timestamp_cannot_revive_an_old_signature(): void
    {
        // t is inside the signed material, so restamping breaks the signature.
        $old = time() - 600;

        $this->assertFalse(WizPayCheckout::verifyWebhook(
            self::BODY,
            self::header(time(), self::sign($old, self::BODY)),
            self::SECRET,
        ));
    }

    /** @return array<string, array{string}> */
    public static function malformedHeaders(): array
    {
        return [
            'nonsense' => ['nonsense'],
            'no v1' => ['t=1761004800'],
            'no t' => ['v1=deadbeef'],
            'non numeric t' => ['t=abc,v1=deadbeef'],
            'empty' => [''],
        ];
    }

    #[DataProvider('malformedHeaders')]
    public function test_rejects_a_malformed_header(string $header): void
    {
        $this->assertFalse(WizPayCheckout::verifyWebhook(self::BODY, $header, self::SECRET));
    }

    public function test_rejects_an_empty_secret(): void
    {
        $this->assertFalse(WizPayCheckout::verifyWebhook(self::BODY, self::fresh(self::BODY), ''));
    }

    public function test_verifies_raw_bytes_so_a_reserialized_body_does_not_match(): void
    {
        $sig = self::fresh(self::BODY);

        $this->assertTrue(WizPayCheckout::verifyWebhook(self::BODY, $sig, self::SECRET));
        $this->assertFalse(WizPayCheckout::verifyWebhook(self::BODY . ' ', $sig, self::SECRET));
    }

    public function test_parse_webhook_returns_the_event_when_it_verifies(): void
    {
        $event = WizPayCheckout::parseWebhook(
            self::BODY,
            self::header(self::T, self::V1),
            self::SECRET,
            self::NO_TTL,
        );

        $this->assertSame('checkout.completed', $event['type']);
        $this->assertSame(12360, $event['data']['total_minor']);
    }

    public function test_parse_webhook_throws_rather_than_returning_an_unverified_event(): void
    {
        $this->expectException(WizPayError::class);

        WizPayCheckout::parseWebhook(self::BODY, 'nonsense', self::SECRET);
    }
}
