<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\SystemSettingsStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OnlineUsersController extends Controller
{
    public function __construct(private readonly SystemSettingsStore $settingsStore)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User|null $actor */
        $actor = $request->user();
        abort_if(! $actor, 401);

        $query = User::query()
            ->whereNotNull('last_seen_at')
            ->where('last_seen_at', '>=', now()->subMinutes(5));

        $role = $actor->role?->value ?? (string) $actor->role;

        if ($role === UserRole::SUPER_ADMIN->value) {
            // No additional scoping.
        } elseif ($role === UserRole::MANAGER_PARENT->value) {
            $query
                ->where('tenant_id', $actor->tenant_id)
                ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value]);
        } elseif ($role === UserRole::MANAGER->value) {
            $query->where(function ($builder) use ($actor): void {
                $builder
                    ->where('id', $actor->id)
                    ->orWhere(function ($teamQuery) use ($actor): void {
                        $teamQuery
                            ->where('tenant_id', $actor->tenant_id)
                            ->where('role', UserRole::RESELLER->value)
                            ->where('created_by', $actor->id);
                    });
            });
        } elseif ($role === UserRole::RESELLER->value) {
            $showForResellers = (bool) data_get($this->settingsStore->all(), 'widgets.show_online_widget_to_resellers', false);
            if (! $showForResellers) {
                return response()->json(['data' => []]);
            }

            $query
                ->where('tenant_id', $actor->tenant_id)
                ->whereIn('role', [UserRole::MANAGER->value, UserRole::RESELLER->value]);
        } else {
            return response()->json(['data' => []]);
        }

        $users = $query
            ->orderByDesc('last_seen_at')
            ->limit(100)
            ->get(['id', 'name', 'role']);

        return response()->json([
            'data' => $users->map(fn (User $user): array => [
                'masked_name' => $this->maskName((string) $user->name),
                'role' => $user->role?->value ?? (string) $user->role,
            ])->values(),
        ]);
    }

    public function widgetSettings(): JsonResponse
    {
        return response()->json([
            'data' => [
                'show_online_widget_to_resellers' => (bool) data_get($this->settingsStore->all(), 'widgets.show_online_widget_to_resellers', false),
            ],
        ]);
    }

    private function maskName(string $name): string
    {
        $trimmed = trim($name);
        $length = mb_strlen($trimmed);

        if ($length <= 3) {
            return '***';
        }

        $first = mb_substr($trimmed, 0, 1);
        $last = mb_substr($trimmed, -1);

        return $first.str_repeat('*', max(1, $length - 2)).$last;
    }
}

