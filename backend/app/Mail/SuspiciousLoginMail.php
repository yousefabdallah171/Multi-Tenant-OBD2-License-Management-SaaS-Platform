<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SuspiciousLoginMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userEmail,
        public string $ip,
        public string $country,
        public string $city,
        public string $device,
        public string $loginTime,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New Login Detected - OBD2SW'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.suspicious-login'
        );
    }
}

