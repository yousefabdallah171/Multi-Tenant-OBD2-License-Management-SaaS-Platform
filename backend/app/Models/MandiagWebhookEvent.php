<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MandiagWebhookEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'event_id',
        'event_type',
        'payload',
        'occurred_at',
    ];

    protected $casts = [
        'payload'      => 'array',
        'occurred_at'  => 'datetime',
        'processed_at' => 'datetime',
    ];
}
