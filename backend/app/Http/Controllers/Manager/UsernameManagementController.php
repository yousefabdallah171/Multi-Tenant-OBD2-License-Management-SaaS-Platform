<?php

namespace App\Http\Controllers\Manager;

use App\Models\BiosUsernameLink;
use App\Models\License;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UsernameManagementController extends BaseManagerController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['nullable', 'in:reseller,customer'],
            'locked' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $this->teamUsersQuery($request)->latest();

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

        $users = $query->paginate((int) ($validated['per_page'] ?? 10));

        return response()->json([
            'data' => collect($users->items())->map(fn (User $user): array => $this->serializeUser($user))->values(),
            'meta' => $this->paginationMeta($users),
        ]);
    }

    public function unlock(Request $request, User $user): JsonResponse
    {
        $target = $this->resolveTeamUser($request, $user);
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $this->assertUsernameCanBeManaged($target);

        $target->update(['username_locked' => false]);

        $this->logActivity($request, 'username.unlock', sprintf('Unlocked username for %s.', $target->email), [
            'target_user_id' => $target->id,
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $this->serializeUser($target->fresh())]);
    }

    public function changeUsername(Request $request, User $user): JsonResponse
    {
        $target = $this->resolveTeamUser($request, $user);
        $this->assertUsernameCanBeManaged($target);
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username,'.$target->id],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $target->update([
            'username' => $validated['username'],
            'username_locked' => false,
        ]);

        $this->logActivity($request, 'username.change', sprintf('Changed username for %s.', $target->email), [
            'target_user_id' => $target->id,
            'new_username' => $validated['username'],
            'reason' => $validated['reason'] ?? null,
        ]);

        return response()->json(['data' => $this->serializeUser($target->fresh())]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $target = $this->resolveTeamUser($request, $user);
        $validated = $request->validate([
            'password' => ['nullable', 'string', 'min:8'],
            'revoke_tokens' => ['nullable', 'boolean'],
        ]);

        $password = $validated['password'] ?? Str::password(12, symbols: false);
        $target->update(['password' => Hash::make($password)]);

        if (($validated['revoke_tokens'] ?? false) === true) {
            $exceptTokenId = $request->user()?->is($target) ? $request->user()?->currentAccessToken()?->getKey() : null;
            $target->revokeAuthTokens($exceptTokenId);
        }

        $this->logActivity($request, 'username.reset_password', sprintf('Reset password for %s.', $target->email), [
            'target_user_id' => $target->id,
            'revoke_tokens' => $validated['revoke_tokens'] ?? false,
        ]);

        return response()->json([
            'message' => 'Password reset successfully.',
            'temporary_password' => $password,
        ]);
    }

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
