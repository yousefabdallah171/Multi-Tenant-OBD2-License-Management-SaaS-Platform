<?php

namespace App\Http\Requests;

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
        return [
            'customer_name' => ['required', 'string', 'min:2', 'max:5000'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9]{6,20}$/'],
            'bios_id' => ['required', 'string', 'min:5', 'max:255'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
        ];
    }
}

