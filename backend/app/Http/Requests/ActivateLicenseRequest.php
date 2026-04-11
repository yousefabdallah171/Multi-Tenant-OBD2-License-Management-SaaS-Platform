<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use App\Support\CustomerOwnership;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ActivateLicenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $role = $this->user()?->role?->value ?? (string) $this->user()?->role;
        $isReseller = $role === UserRole::RESELLER->value;

        return [
            'customer_name' => ['required', 'string', 'min:2', 'max:5000'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'bios_id' => ['required', 'string', 'min:5', 'max:255'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'preset_id' => [
                Rule::requiredIf($isReseller),
                'nullable',
                'integer',
                Rule::exists('program_duration_presets', 'id')->where(function ($query): void {
                    $programId = (int) $this->input('program_id');
                    $query->where('program_id', $programId)->where('is_active', true);
                }),
            ],
            'duration_days' => [$isReseller ? 'nullable' : 'required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => [$isReseller ? 'nullable' : 'required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
        ];
    }
}
