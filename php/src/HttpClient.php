<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout;

/**
 * Minimal JSON client.
 *
 * Deliberately dependency-free. A payments SDK installed into a merchant's
 * server is a supply-chain surface, so this ships with no required packages at
 * all: ext-curl and ext-json are already there on any PHP that serves a
 * checkout. `$transport` exists so tests can run without a network, and so an
 * integrator who standardises on Guzzle or another PSR-18 client can hand one
 * in rather than having ours forced on them.
 *
 * @phpstan-type Transport callable(string, string, string|null, array<int,string>): array{int, string}
 */
final class HttpClient
{
    private readonly string $base;

    /** @var null|callable(string, string, string|null, array<int,string>): array{int, string} */
    private $transport;

    /**
     * @param array<string,string> $headers sent on every request.
     * @param null|callable(string, string, string|null, array<int,string>): array{int, string} $transport
     *        Override the network call. Receives (method, url, body, headers)
     *        and must return [statusCode, responseBody].
     */
    public function __construct(
        private readonly array $headers,
        ?string $apiBase = null,
        ?callable $transport = null,
        private readonly int $timeoutSeconds = 30,
    ) {
        $this->base = Environment::normalizeApiBase($apiBase);
        $this->transport = $transport;
    }

    /**
     * @param array<string,mixed>|null $body
     * @return array<string,mixed>
     */
    public function post(string $path, ?array $body = null): array
    {
        return $this->request('POST', $path, $body);
    }

    /** @return array<string,mixed> */
    public function get(string $path): array
    {
        return $this->request('GET', $path, null);
    }

    /**
     * @param array<string,mixed>|null $body
     * @return array<string,mixed>
     */
    private function request(string $method, string $path, ?array $body): array
    {
        $url = $this->base . $path;
        $payload = $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR);

        $headers = ['Content-Type: application/json', 'Accept: application/json'];
        foreach ($this->headers as $name => $value) {
            $headers[] = $name . ': ' . $value;
        }

        [$status, $raw] = $this->transport !== null
            ? ($this->transport)($method, $url, $payload, $headers)
            : $this->curl($method, $url, $payload, $headers);

        $parsed = [];
        if ($raw !== '') {
            try {
                $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
                $parsed = is_array($decoded) ? $decoded : [];
            } catch (\JsonException) {
                // A non-JSON body from a payments API means something in FRONT of
                // it answered: a proxy, a WAF, an error page. Say that, rather
                // than surfacing an opaque parse error from deep in the stack.
                throw new WizPayError(
                    "WIZPay returned a non-JSON response (HTTP {$status}). Check that apiBase points at a WIZPay API.",
                    $status,
                );
            }
        }

        if ($status < 200 || $status >= 300) {
            $message = $parsed['message'] ?? $parsed['error'] ?? "WIZPay request failed (HTTP {$status}).";
            if (is_array($message)) {
                // Validation errors arrive as a list; join rather than printing "Array".
                $message = implode('; ', array_map(static fn ($m) => (string) $m, $message));
            }
            $code = isset($parsed['error']) && is_string($parsed['error']) ? $parsed['error'] : null;

            throw new WizPayError((string) $message, $status, $code);
        }

        return $parsed;
    }

    /**
     * @param array<int,string> $headers
     * @return array{int, string}
     */
    private function curl(string $method, string $url, ?string $payload, array $headers): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new WizPayError('WIZPay: could not initialise cURL.', 0);
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => 10,
            // Never negotiable for a payments call: without verification an
            // intercepting proxy can read the secret key and rewrite the amount.
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($errno !== 0 || $raw === false) {
            throw new WizPayError("WIZPay: request failed before a response ({$error}).", 0);
        }

        return [$status, (string) $raw];
    }
}
