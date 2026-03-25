<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserTablePreference;

class TablePreferenceService
{
    /**
     * @param  list<string>  $availableColumns
     * @param  list<string>  $lockedColumns
     */
    public function getForUser(User $user, string $tableKey, array $availableColumns, array $lockedColumns = []): array
    {
        $preference = UserTablePreference::query()
            ->where('user_id', $user->id)
            ->where('table_key', $tableKey)
            ->first();

        if ($preference === null) {
            return [
                'table_key' => $tableKey,
                'visible_columns' => [],
                'per_page' => null,
            ];
        }

        $visibleColumns = $this->sanitizeVisibleColumns(
            is_array($preference?->visible_columns) ? $preference->visible_columns : [],
            $availableColumns,
            $lockedColumns,
        );

        return [
            'table_key' => $tableKey,
            'visible_columns' => $visibleColumns,
            'per_page' => $preference?->per_page,
        ];
    }

    /**
     * @param  list<string>  $visibleColumns
     * @param  list<string>  $availableColumns
     * @param  list<string>  $lockedColumns
     */
    public function updateForUser(User $user, string $tableKey, array $visibleColumns, ?int $perPage, array $availableColumns, array $lockedColumns = []): array
    {
        $sanitizedVisibleColumns = $this->sanitizeVisibleColumns($visibleColumns, $availableColumns, $lockedColumns);

        $preference = UserTablePreference::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'table_key' => $tableKey,
            ],
            [
                'visible_columns' => $sanitizedVisibleColumns,
                'per_page' => $perPage,
            ],
        );

        return [
            'table_key' => $tableKey,
            'visible_columns' => $sanitizedVisibleColumns,
            'per_page' => $preference->per_page,
        ];
    }

    /**
     * @param  list<string>  $visibleColumns
     * @param  list<string>  $availableColumns
     * @param  list<string>  $lockedColumns
     * @return list<string>
     */
    private function sanitizeVisibleColumns(array $visibleColumns, array $availableColumns, array $lockedColumns): array
    {
        $availableLookup = array_fill_keys($availableColumns, true);
        $lockedLookup = array_fill_keys($lockedColumns, true);

        $sanitized = array_values(array_filter(
            array_unique($visibleColumns),
            fn ($column): bool => is_string($column) && isset($availableLookup[$column]),
        ));

        foreach ($lockedColumns as $lockedColumn) {
            if (isset($availableLookup[$lockedColumn]) && ! in_array($lockedColumn, $sanitized, true)) {
                $sanitized[] = $lockedColumn;
            }
        }

        if ($sanitized === []) {
            foreach ($availableColumns as $column) {
                if (! isset($lockedLookup[$column]) || in_array($column, $lockedColumns, true)) {
                    $sanitized[] = $column;
                }
            }
        }

        return $sanitized;
    }
}
