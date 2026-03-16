<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

class SystemSettingsStore
{
    private string $path;

    public function __construct()
    {
        $this->path = storage_path('app/system-settings.json');
    }

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        $defaults = $this->defaults();

        if (! File::exists($this->path)) {
            return $defaults;
        }

        $stored = json_decode((string) File::get($this->path), true);

        if (! is_array($stored)) {
            return $defaults;
        }

        return array_replace_recursive($defaults, $stored);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function update(array $payload): array
    {
        $settings = array_replace_recursive($this->all(), $payload);

        File::ensureDirectoryExists(dirname($this->path));
        File::put($this->path, json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $settings;
    }

    /**
     * @return array<string, mixed>
     */
    private function defaults(): array
    {
        return [
            'general' => [
                'platform_name' => config('app.name', 'OBD2SW'),
                'default_trial_days' => 7,
                'maintenance_mode' => false,
                'server_timezone' => config('app.timezone', 'UTC'),
            ],
            'api' => [
                'url' => config('external-api.url'),
                'key' => config('external-api.key'),
                'timeout' => config('external-api.timeout', 10),
                'retries' => config('external-api.retries', 3),
            ],
            'notifications' => [
                'email_enabled' => true,
                'pusher_enabled' => true,
            ],
            'security' => [
                'min_password_length' => 8,
                'session_timeout' => 120,
            ],
            'widgets' => [
                'show_online_widget_to_resellers' => true,
            ],
        ];
    }
}
