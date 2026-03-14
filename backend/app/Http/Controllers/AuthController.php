<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Jobs\ResolveIpGeolocation;
use App\Mail\SuspiciousLoginMail;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\LoginSecurityService;
use App\Enums\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function __construct(
        private readonly LoginSecurityService $loginSecurity,
    ) {
    }

    public function login(
        LoginRequest $request,
    ): JsonResponse
    {
        $email = strtolower(trim($request->string('email')->toString()));
        $ip = trim((string) $request->ip());
        $userAgent = (string) $request->userAgent();

        $preLockStatus = $this->loginSecurity->isLocked($email, $ip);
        if (($preLockStatus['locked'] ?? false) === true) {
            if (($preLockStatus['reason'] ?? null) === 'account_locked') {
                $attemptState = $this->loginSecurity->recordFailedAttempt($email, $ip, $userAgent);
                if (($attemptState['newly_blocked'] ?? false) === true) {
                    $this->logSecurityBlockIp($ip, $email, $userAgent);
                }

                return $this->lockoutResponse($email, $attemptState, $this->loginSecurity);
            }

            return $this->lockoutResponse($email, $preLockStatus, $this->loginSecurity);
        }

        /** @var User|null $user */
        $user = User::query()->with('tenant')->where('email', $email)->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            $attemptState = $this->loginSecurity->recordFailedAttempt($email, $ip, $userAgent);
            if (($attemptState['newly_blocked'] ?? false) === true) {
                $this->logSecurityBlockIp($ip, $email, $userAgent);
            }

            if (($attemptState['locked'] ?? false) === true) {
                return $this->lockoutResponse($email, $attemptState, $this->loginSecurity);
            }

            return response()
                ->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED)
                ->withHeaders($this->rateHeaders($email, $this->loginSecurity));
        }

        // CUSTOMER SILENT DENY
        // Returns identical 401 as wrong password - no trace of customer role.
        $userRole = $user->role?->value ?? (string) $user->role;
        if ($userRole === 'customer') {
            $attemptState = $this->loginSecurity->recordFailedAttempt($email, $ip, $userAgent);
            if (($attemptState['newly_blocked'] ?? false) === true) {
                $this->logSecurityBlockIp($ip, $email, $userAgent);
            }

            if (($attemptState['locked'] ?? false) === true) {
                return $this->lockoutResponse($email, $attemptState, $this->loginSecurity);
            }

            return response()
                ->json(['message' => 'Invalid credentials.'], Response::HTTP_UNAUTHORIZED)
                ->withHeaders($this->rateHeaders($email, $this->loginSecurity));
        }

        if ($user->status !== 'active') {
            return $this->inactiveAccountResponse(
                $user->status === 'suspended' ? 'account_suspended' : 'account_inactive',
                $user->status === 'suspended'
                    ? 'This account is currently suspended.'
                    : 'This account is currently inactive.',
            );
        }

        if ($userRole !== UserRole::SUPER_ADMIN->value && $user->tenant && $user->tenant->status !== 'active') {
            return $this->inactiveAccountResponse(
                $user->tenant->status === 'suspended' ? 'tenant_suspended' : 'tenant_inactive',
                $user->tenant->status === 'suspended'
                    ? 'This workspace is currently suspended.'
                    : 'This workspace is currently inactive.',
            );
        }

        $knownIp = $user->ipLogs()
            ->where('ip_address', $ip)
            ->where('action', 'login.success')
            ->exists();

        $ipLog = $user->ipLogs()->create([
            'tenant_id' => $user->tenant_id,
            'ip_address' => $ip,
            'country' => null,
            'city' => null,
            'isp' => null,
            'reputation_score' => 'low',
            'action' => 'login.success',
        ]);
        ResolveIpGeolocation::dispatch((int) $ipLog->id);

        if (! $knownIp) {
            try {
                Mail::to($user->email)->queue(new SuspiciousLoginMail(
                    userEmail: $user->email,
                    ip: $ip,
                    country: 'Unknown',
                    city: '',
                    device: $this->loginSecurity->summarizeDevice($userAgent),
                    loginTime: now()->toDateTimeString(),
                ));
            } catch (\Throwable) {
                // Never block login flow on mail errors.
            }
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $this->loginSecurity->clearAttempts($email, $ip);

        return response()
            ->json([
                'token' => $token,
                'user' => $user,
            ])
            ->withHeaders($this->rateHeaders($email, $this->loginSecurity));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()?->load('tenant'),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $validated = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
                'phone' => ['nullable', 'string', 'max:20'],
                'timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
                'branding.primary_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            ]);

            $supportsBranding = Schema::hasColumn('users', 'branding');

            if ($supportsBranding && isset($validated['branding'])) {
                $user->branding = $validated['branding'];
            }

            unset($validated['branding']);

            $user->update($validated);

            return response()->json([
                'message' => 'Profile updated successfully.',
                'user' => $user->fresh('tenant'),
            ]);
        } catch (\Throwable $exception) {
            Log::error('profile.update.failed', [
                'user_id' => $user?->id,
                'payload_keys' => array_keys($request->all()),
                'timezone' => $request->input('timezone'),
                'has_branding' => $request->has('branding'),
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    public function updatePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * @param array<string, mixed> $lockStatus
     */
    private function lockoutResponse(string $email, array $lockStatus, LoginSecurityService $loginSecurity): JsonResponse
    {
        $isIpBlocked = ($lockStatus['reason'] ?? null) === 'ip_blocked';
        $secondsRemaining = $isIpBlocked ? 0 : (int) ($lockStatus['seconds_remaining'] ?? 0);

        return response()
            ->json([
                'message' => $isIpBlocked
                    ? 'Too many failed attempts. This IP address is permanently blocked.'
                    : 'Too many failed attempts. Account is temporarily locked.',
                'locked' => true,
                'reason' => $lockStatus['reason'] ?? 'account_locked',
                'unlocks_at' => $lockStatus['unlocks_at'] ?? null,
                'seconds_remaining' => $lockStatus['seconds_remaining'] ?? null,
            ], Response::HTTP_TOO_MANY_REQUESTS)
            ->withHeaders([
                ...$this->rateHeaders($email, $loginSecurity, forceRemaining: 0),
                'Retry-After' => $secondsRemaining,
            ]);
    }

    /**
     * @return array<string, int>
     */
    private function rateHeaders(string $email, LoginSecurityService $loginSecurity, ?int $forceRemaining = null): array
    {
        $remaining = $forceRemaining ?? $loginSecurity->getRemainingAttempts($email);

        return [
            'X-RateLimit-Limit' => 10,
            'X-RateLimit-Remaining' => $remaining,
            'X-RateLimit-Reset' => $loginSecurity->getResetTimestamp(),
        ];
    }

    private function logSecurityBlockIp(string $ip, string $email, string $userAgent): void
    {
        ActivityLog::query()->create([
            'tenant_id' => null,
            'user_id' => null,
            'action' => 'security.block_ip',
            'description' => sprintf('Blocked IP %s after repeated failed logins.', $ip),
            'metadata' => [
                'blocked_ip' => $ip,
                'email' => $email,
                'user_agent' => $userAgent,
            ],
            'ip_address' => $ip,
        ]);
    }

    private function inactiveAccountResponse(string $reason, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'reason' => $reason,
        ], Response::HTTP_FORBIDDEN);
    }
}
