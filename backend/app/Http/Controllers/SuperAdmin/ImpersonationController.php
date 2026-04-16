<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\ImpersonationTicket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ImpersonationController extends BaseSuperAdminController
{
    private const TICKET_TTL_MINUTES = 10;

    private const SESSION_TTL_MINUTES = 10;

    public function targets(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'in:manager_parent,manager,reseller'],
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'status' => ['nullable', 'in:active,suspended,inactive,deactive'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = User::query()
            ->with('tenant:id,name')
            ->select(['id', 'tenant_id', 'name', 'email', 'role', 'status', 'last_seen_at'])
            ->whereIn('role', [
                UserRole::MANAGER_PARENT->value,
                UserRole::MANAGER->value,
                UserRole::RESELLER->value,
            ])
            ->latest('id');

        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', (int) $validated['tenant_id']);
        }

        if (! empty($validated['status'])) {
            $status = $validated['status'] === 'deactive' ? 'inactive' : $validated['status'];
            $query->where('status', $status);
        }

        if (! empty($validated['search'])) {
            $search = trim((string) $validated['search']);
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('username', 'like', '%'.$search.'%');
            });
        }

        $items = $query->paginate($perPage);

        return response()->json([
            'data' => collect($items->items())->map(function (User $user): array {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role?->value ?? (string) $user->role,
                    'status' => $user->status,
                    'tenant' => $user->tenant ? [
                        'id' => $user->tenant->id,
                        'name' => $user->tenant->name,
                    ] : null,
                    'last_seen_at' => $user->last_seen_at?->toIso8601String(),
                ];
            })->values(),
            'meta' => $this->paginationMeta($items),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $token = $actor->currentAccessToken();

        if ($this->isImpersonationToken($token?->name)) {
            $this->logImpersonation($request, 'impersonation.start.denied', 'Impersonation start denied: nested impersonation token.', [
                'reason' => 'nested_impersonation',
            ]);

            return response()->json([
                'message' => 'You cannot start impersonation from an impersonated session.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'target_user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        /** @var User|null $target */
        $target = User::query()->find($validated['target_user_id']);
        $targetRole = $target?->role?->value ?? (string) $target?->role;

        if (! $target || ! in_array($targetRole, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value], true)) {
            $this->logImpersonation($request, 'impersonation.start.denied', 'Impersonation start denied: invalid target role.', [
                'target_user_id' => $validated['target_user_id'],
                'target_role' => $targetRole,
                'reason' => 'invalid_target_role',
            ]);

            return response()->json([
                'message' => 'Target account cannot be impersonated.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $launchToken = Str::random(96);
        $actorTokenFingerprint = $this->tokenFingerprintFromRequest($request);
        $ticket = ImpersonationTicket::query()->create([
            'actor_user_id' => $actor->id,
            'actor_token_id' => $token?->id,
            'actor_token_fingerprint' => $actorTokenFingerprint,
            'target_user_id' => $target->id,
            'secret_hash' => hash('sha256', $launchToken),
            'expires_at' => now()->addMinutes(self::TICKET_TTL_MINUTES),
        ]);

        $this->logImpersonation($request, 'impersonation.start', sprintf('Started impersonation launch ticket for %s.', $target->email), [
            'ticket_id' => $ticket->id,
            'target_user_id' => $target->id,
            'target_role' => $targetRole,
            'target_tenant_id' => $target->tenant_id,
            'expires_at' => $ticket->expires_at?->toIso8601String(),
        ]);

        return response()->json([
            'data' => [
                'token' => $launchToken,
                'expires_at' => $ticket->expires_at?->toIso8601String(),
                'target' => [
                    'id' => $target->id,
                    'name' => $target->name,
                    'email' => $target->email,
                    'role' => $targetRole,
                    'tenant_id' => $target->tenant_id,
                ],
            ],
        ]);
    }

    public function exchange(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $currentToken = $actor->currentAccessToken();

        if ($this->isImpersonationToken($currentToken?->name)) {
            $this->logImpersonation($request, 'impersonation.exchange.denied', 'Impersonation exchange denied: nested impersonation token.', [
                'reason' => 'nested_impersonation',
            ]);

            return response()->json([
                'message' => 'You cannot exchange impersonation from an impersonated session.',
            ], Response::HTTP_FORBIDDEN);
        }

        $validated = $request->validate([
            'token' => ['required', 'string', 'min:64', 'max:255'],
        ]);

        $tokenHash = hash('sha256', trim((string) $validated['token']));
        $currentFingerprint = $this->tokenFingerprintFromRequest($request);

        /** @var ImpersonationTicket|null $ticket */
        $ticket = DB::transaction(function () use ($tokenHash, $actor, $currentToken, $currentFingerprint, $request): ?ImpersonationTicket {
            /** @var ImpersonationTicket|null $locked */
            $locked = ImpersonationTicket::query()
                ->where('secret_hash', $tokenHash)
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                return null;
            }

            $sameActor = (int) $locked->actor_user_id === (int) $actor->id;
            $sameToken = ($locked->actor_token_id === null && $currentToken?->id === null)
                || ((int) $locked->actor_token_id === (int) ($currentToken?->id ?? 0));
            $sameFingerprint = ($locked->actor_token_fingerprint === null && $currentFingerprint === null)
                || (is_string($locked->actor_token_fingerprint) && is_string($currentFingerprint) && hash_equals($locked->actor_token_fingerprint, $currentFingerprint));
            $expired = $locked->expires_at?->isPast() === true;
            $used = $locked->used_at !== null;

            if (! $sameActor || ! $sameToken || ! $sameFingerprint || $expired || $used) {
                $locked->setAttribute('consumed_now', false);
                return $locked;
            }

            $locked->forceFill([
                'used_at' => now(),
                'used_ip' => (string) $request->ip(),
                'used_user_agent' => Str::limit((string) $request->userAgent(), 1024, ''),
            ])->save();

            $fresh = $locked->fresh(['target']);
            $fresh?->setAttribute('consumed_now', true);

            return $fresh;
        });

        if (! $ticket) {
            $this->logImpersonation($request, 'impersonation.exchange.denied', 'Impersonation exchange denied: ticket not found.', [
                'reason' => 'ticket_not_found',
            ]);

            return response()->json([
                'message' => 'Impersonation token is invalid or expired.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $sameActor = (int) $ticket->actor_user_id === (int) $actor->id;
        $sameToken = ($ticket->actor_token_id === null && $currentToken?->id === null)
            || ((int) $ticket->actor_token_id === (int) ($currentToken?->id ?? 0));
        $sameFingerprint = ($ticket->actor_token_fingerprint === null && $currentFingerprint === null)
            || (is_string($ticket->actor_token_fingerprint) && is_string($currentFingerprint) && hash_equals($ticket->actor_token_fingerprint, $currentFingerprint));
        $expired = $ticket->expires_at?->isPast() === true;
        $consumedNow = (bool) $ticket->getAttribute('consumed_now');

        if (! $sameActor || ! $sameToken || ! $sameFingerprint || $expired || ! $consumedNow) {
            $this->logImpersonation($request, 'impersonation.exchange.denied', 'Impersonation exchange denied: ticket mismatch or expired.', [
                'ticket_id' => $ticket->id,
                'reason' => $expired ? 'ticket_expired' : 'ticket_mismatch',
            ]);

            return response()->json([
                'message' => 'Impersonation token is invalid or expired.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $target = $ticket->target()->first();
        if (! $target) {
            $this->logImpersonation($request, 'impersonation.exchange.denied', 'Impersonation exchange denied: target account missing.', [
                'ticket_id' => $ticket->id,
                'reason' => 'target_missing',
            ]);

            return response()->json([
                'message' => 'Target account no longer exists.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $targetRole = $target->role?->value ?? (string) $target->role;
        if (! in_array($targetRole, [UserRole::MANAGER_PARENT->value, UserRole::MANAGER->value, UserRole::RESELLER->value], true)) {
            $this->logImpersonation($request, 'impersonation.exchange.denied', 'Impersonation exchange denied: target role not allowed.', [
                'ticket_id' => $ticket->id,
                'target_user_id' => $target->id,
                'target_role' => $targetRole,
                'reason' => 'target_role_not_allowed',
            ]);

            return response()->json([
                'message' => 'Target account cannot be impersonated.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $impersonationToken = $target->createToken(
            'impersonation-session',
            ['impersonation:session'],
            now()->addMinutes(self::SESSION_TTL_MINUTES),
        );

        $this->logImpersonation($request, 'impersonation.exchange', sprintf('Super admin exchanged impersonation session for %s.', $target->email), [
            'ticket_id' => $ticket->id,
            'target_user_id' => $target->id,
            'target_role' => $targetRole,
            'target_tenant_id' => $target->tenant_id,
            'session_expires_at' => now()->addMinutes(self::SESSION_TTL_MINUTES)->toIso8601String(),
        ]);

        return response()->json([
            'data' => [
                'token' => $impersonationToken->plainTextToken,
                'expires_at' => now()->addMinutes(self::SESSION_TTL_MINUTES)->toIso8601String(),
                'user' => $target->fresh('tenant'),
                'impersonation' => [
                    'active' => true,
                    'actor' => [
                        'id' => $actor->id,
                        'name' => $actor->name,
                        'email' => $actor->email,
                    ],
                    'target' => [
                        'id' => $target->id,
                        'name' => $target->name,
                        'email' => $target->email,
                        'role' => $targetRole,
                    ],
                    'started_at' => now()->toIso8601String(),
                    'expires_at' => now()->addMinutes(self::SESSION_TTL_MINUTES)->toIso8601String(),
                ],
            ],
        ]);
    }

    public function stop(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'target_user_id' => ['nullable', 'integer'],
            'target_role' => ['nullable', 'string', 'max:50'],
        ]);

        $this->logImpersonation($request, 'impersonation.stop', 'Super admin stopped impersonation session.', [
            'target_user_id' => $validated['target_user_id'] ?? null,
            'target_role' => $validated['target_role'] ?? null,
        ]);

        return response()->json([
            'message' => 'Impersonation session stopped.',
        ]);
    }

    private function isImpersonationToken(?string $tokenName): bool
    {
        return $tokenName === 'impersonation-session';
    }

    private function tokenFingerprintFromRequest(Request $request): ?string
    {
        $rawToken = (string) ($request->bearerToken() ?? '');
        if ($rawToken === '') {
            $cookieName = config('sanctum.cookie_name', 'auth_token');
            $rawToken = (string) ($request->cookie($cookieName) ?? '');
        }

        if ($rawToken === '') {
            return null;
        }

        return hash('sha256', $rawToken);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function logImpersonation(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }
}
