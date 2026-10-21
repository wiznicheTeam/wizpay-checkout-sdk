<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout\Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Wizniche\WizpayCheckout\WizPayCheckout;
use Wizniche\WizpayCheckout\WizPayError;

final class SessionTest extends TestCase
{
    private const SECRET_KEY = 'wzp_test_0123456789abcdefghijklmnopqrstuvwxyzABCDEF';

    /** @var list<array{string,string,string|null,array<int,string>}> */
    private array $calls = [];

    /** A transport that records the request and replays a canned response. */
    private function stub(int $status, array|string $body): callable
    {
        return function (string $method, string $url, ?string $payload, array $headers) use ($status, $body): array {
            $this->calls[] = [$method, $url, $payload, $headers];

            return [$status, is_string($body) ? $body : json_encode($body, JSON_THROW_ON_ERROR)];
        };
    }

    /** @return array<string,mixed> */
    private function lastBody(): array
    {
        return json_decode($this->calls[0][2] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_creates_a_session_and_returns_the_client_secret(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, 'https://api.example.test', $this->stub(200, [
            'id' => 'sess_1',
            'clientSecret' => 'cs_live_once_only',
            'pricing' => ['subtotalMinor' => 4200, 'tipMinor' => 0, 'surchargeMinor' => 126, 'totalMinor' => 4326],
        ]));

        $session = $sdk->createSession([
            'storeId' => 'store-1',
            'amountMinor' => 4200,
            'merchantReference' => 'ORD-1',
        ]);

        $this->assertSame('sess_1', $session['id']);
        $this->assertSame('cs_live_once_only', $session['clientSecret']);
        $this->assertSame(4326, $session['pricing']['totalMinor']);
    }

    public function test_sends_the_secret_key_as_a_header_and_never_in_the_body(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, 'https://api.example.test', $this->stub(200, ['id' => 'sess_1']));
        $sdk->createSession(['storeId' => 's', 'amountMinor' => 100, 'merchantReference' => 'r']);

        [$method, $url, $payload, $headers] = $this->calls[0];

        $this->assertSame('POST', $method);
        $this->assertSame('https://api.example.test/v1/checkout/sessions', $url);
        $this->assertContains('x-api-key: ' . self::SECRET_KEY, $headers);
        $this->assertStringNotContainsString(self::SECRET_KEY, (string) $payload);
    }

    /**
     * The most expensive integration bug there is: 10.00 silently becomes 10
     * cents, or a float rounds the wrong way. Reject it at the boundary rather
     * than charging the wrong amount.
     */
    public function test_rejects_a_decimal_amount_rather_than_charging_the_wrong_sum(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(200, []));

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('1000, not 10');

        $sdk->createSession(['storeId' => 's', 'amountMinor' => 10.00, 'merchantReference' => 'r']);
    }

    public function test_rejects_a_publishable_key_and_explains_why(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot create');

        new WizPayCheckout('wzp_pk_test_' . str_repeat('a', 43));
    }

    public function test_an_api_error_carries_the_status_and_message(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(403, [
            'error' => 'FORBIDDEN',
            'message' => 'Missing API scope: checkout:write',
        ]));

        try {
            $sdk->createSession(['storeId' => 's', 'amountMinor' => 100, 'merchantReference' => 'r']);
            $this->fail('expected a WizPayError');
        } catch (WizPayError $e) {
            $this->assertSame(403, $e->status);
            $this->assertSame('FORBIDDEN', $e->errorCode);
            $this->assertStringContainsString('checkout:write', $e->getMessage());
        }
    }

    /** Validation errors arrive as a list; the message must not read "Array". */
    public function test_a_validation_error_list_is_joined_into_the_message(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(400, [
            'message' => ['amountMinor must be an integer', 'storeId should not be empty'],
        ]));

        $this->expectExceptionMessage('amountMinor must be an integer; storeId should not be empty');

        $sdk->createSession(['storeId' => 's', 'amountMinor' => 100, 'merchantReference' => 'r']);
    }

    /** A WAF or proxy answering instead of the API must say so, not "parse error". */
    public function test_a_non_json_response_names_the_likely_cause(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(502, '<html>Bad Gateway</html>'));

        $this->expectException(WizPayError::class);
        $this->expectExceptionMessage('non-JSON response (HTTP 502)');

        $sdk->createSession(['storeId' => 's', 'amountMinor' => 100, 'merchantReference' => 'r']);
    }

    public function test_requires_the_fields_the_api_will_reject_without(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(200, []));

        $this->expectExceptionMessage('merchantReference is required');

        $sdk->createSession(['storeId' => 's', 'amountMinor' => 100]);
    }

    public function test_order_detail_is_forwarded_for_interchange(): void
    {
        $sdk = new WizPayCheckout(self::SECRET_KEY, null, $this->stub(200, ['id' => 'sess_1']));
        $sdk->createSession([
            'storeId' => 's',
            'amountMinor' => 100,
            'merchantReference' => 'r',
            'enhancedData' => ['lineItems' => [['description' => 'Widget', 'amountMinor' => 100]]],
        ]);

        $this->assertSame('Widget', $this->lastBody()['enhancedData']['lineItems'][0]['description']);
    }
}
