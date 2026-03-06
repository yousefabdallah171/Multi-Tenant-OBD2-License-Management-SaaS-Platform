<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

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
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'bios_id' => ['required', 'string', 'min:5', 'max:255'],
            'program_id' => ['required', 'integer', 'exists:programs,id'],
            'duration_days' => ['required', 'numeric', 'min:0.0001'],
            'price' => ['required', 'numeric', 'min:0'],
        ];
    }
}

