<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Models\ActivityLog;
use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UsernameManagementController extends BaseSuperAdminController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['nullable', 'integer', 'exists:tenants,id'],
            'role' => ['nullable', 'string'],
            'locked' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);

        $query = User::query()->with('tenant')->latest();

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', $validated['tenant_id']);
        }

        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (array_key_exists('locked', $validated)) {
            $query->where('username_locked', (bool) $validated['locked']);
        }

        if (! empty($validated['search'])) {
            $query->where(function ($builder) use ($validated): void {
                $builder
                    ->where('username', 'like', '%'.$validated['search'].'%')
                    ->orWhere('email', 'like', '%'.$validated['search'].'%')
                    ->orWhere('name', 'like', '%'.$validated['search'].'%');
            });
        }

        $users = $query->paginate($perPage);

        return response()->json([
            'data' => collect($users->items())->map(fn (User $user): array => $this->serializeUser($user))->values(),
            'meta' => $this->paginationMeta($users),
        ]);
    }

    public function unlock(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->assertUsernameCanBeManaged($user);
        $user->update(['username_locked' => false]);
        $this->logActivity($request, 'username.unlock', sprintf('Unlocked username for %s.', $user->email), [
            'target_user_id' => $user->id,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $this->serializeUser($user->fresh('tenant'))]);
    }

    public function changeUsername(Request $request, User $user): JsonResponse
    {
        $this->assertUsernameCanBeManaged($user);
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username,'.$user->id],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $user->update([
            'username' => $validated['username'],
            'username_locked' => false,
        ]);

        $this->logActivity($request, 'username.change', sprintf('Changed username for %s.', $user->email), [
            'target_user_id' => $user->id,
            'new_username' => $validated['username'],
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $this->serializeUser($user->fresh('tenant'))]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['nullable', 'string', 'min:8'],
            'revoke_tokens' => ['nullable', 'boolean'],
        ]);

        $password = $validated['password'] ?? Str::password(12, symbols: false);

        $user->update([
            'password' => Hash::make($password),
        ]);

        if (($validated['revoke_tokens'] ?? false) === true) {
            $exceptTokenId = $request->user()?->is($user) ? $request->user()?->currentAccessToken()?->getKey() : null;
            $user->revokeAuthTokens($exceptTokenId);
        }

        $this->logActivity($request, 'username.reset_password', sprintf('Reset password for %s.', $user->email), [
            'target_user_id' => $user->id,
            'revoke_tokens' => $validated['revoke_tokens'] ?? false,
        ]);

        return response()->json([
            'message' => 'Password reset successfully.',
            'temporary_password' => $password,
        ]);
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function logActivity(Request $request, string $action, string $description, array $metadata = []): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $request->user()?->tenant_id,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => $request->ip(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role?->value ?? (string) $user->role,
            'status' => $user->status,
            'username_locked' => $user->username_locked,
            'tenant' => $user->tenant ? [
                'id' => $user->tenant->id,
                'name' => $user->tenant->name,
            ] : null,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function assertUsernameCanBeManaged(User $user): void
    {
        $usernameLower = strtolower((string) $user->username);

        $hasPermanentLink = ($usernameLower !== '' && BiosUsernameLink::whereRaw('LOWER(username) = ?', [$usernameLower])->exists())
            || License::query()
                ->where('customer_id', $user->id)
                ->whereNotNull('bios_id')
                ->get(['bios_id'])
                ->contains(fn (License $license): bool => BiosUsernameLink::whereRaw('LOWER(bios_id) = ?', [strtolower((string) $license->bios_id)])->exists());

        if ($hasPermanentLink) {
            throw ValidationException::withMessages([
                'username' => 'This user has a permanent BIOS-username link. Unlock and username change are blocked.',
            ]);
        }
    }
}
