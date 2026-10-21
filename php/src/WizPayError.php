<?php

declare(strict_types=1);

namespace Wizniche\WizpayCheckout;

use RuntimeException;

/** An error returned by the WIZPay API. */
final class WizPayError extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 0,
        public readonly ?string $errorCode = null,
    ) {
        parent::__construct($message, $status);
    }
}
