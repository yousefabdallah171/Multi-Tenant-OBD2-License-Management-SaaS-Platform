<?php

namespace App\Http\Requests;

use App\Support\CustomerOwnership;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RenewLicenseRequest extends FormRequest
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
            'duration_days' => ['required', 'numeric', 'min:0.0001', 'max:36500'],
            'price' => ['required', 'numeric', 'min:0', 'max:'.CustomerOwnership::MAX_REASONABLE_PRICE],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_date_time' => ['required_if:is_scheduled,true', 'date'],
            'scheduled_timezone' => ['nullable', 'string', 'max:64', Rule::in(timezone_identifiers_list())],
        ];
    }
}
