<?php

namespace App\Http\Controllers\Manager;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
        ]);

        $password = $validated['password'] ?? 'password1234';
        $target->update(['password' => Hash::make($password)]);

        $this->logActivity($request, 'username.reset_password', sprintf('Reset password for %s.', $target->email), [
            'target_user_id' => $target->id,
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
}
