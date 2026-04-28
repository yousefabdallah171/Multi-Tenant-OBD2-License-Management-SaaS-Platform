<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $table = 'super_admin_settings';

    protected $fillable = [
        'setting_key',
        'setting_value',
    ];

    protected $casts = [
        'setting_value' => 'array',
    ];

    public static function getByKey(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('setting_key', $key)->first();
        if (! $row) {
            return $default;
        }

        $value = $row->setting_value;
        if (is_array($value) && array_key_exists('value', $value)) {
            return $value['value'];
        }

        return $value ?? $default;
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(
            ['setting_key' => $key],
            ['setting_value' => ['value' => $value]],
        );
    }
}

