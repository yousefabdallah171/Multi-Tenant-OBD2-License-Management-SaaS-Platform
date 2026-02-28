<?php

namespace App\Http\Controllers;

use App\Services\ExternalApiService;
use Illuminate\Http\JsonResponse;

class ApiProxyController extends Controller
{
    public function __construct(private readonly ExternalApiService $externalApiService)
    {
    }

    public function status(): JsonResponse
    {
        return $this->respond($this->externalApiService->getStatus());
    }

    public function check(string $bios): JsonResponse
    {
        return $this->respond($this->externalApiService->checkUser($bios));
    }

    public function users(): JsonResponse
    {
        return $this->respond($this->externalApiService->listUsers());
    }

    private function respond(array $payload): JsonResponse
    {
        return response()->json($payload, $payload['status_code'] ?? 200);
    }
}
