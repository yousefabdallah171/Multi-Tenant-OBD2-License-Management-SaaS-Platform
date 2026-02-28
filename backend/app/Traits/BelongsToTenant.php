<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::creating(function ($model): void {
            $tenantId = app()->bound('tenant.scope.id') ? app('tenant.scope.id') : null;

            if ($tenantId !== null && blank($model->tenant_id)) {
                $model->tenant_id = $tenantId;
            }
        });

        static::addGlobalScope('tenant', function (Builder $builder): void {
            $tenantId = app()->bound('tenant.scope.id') ? app('tenant.scope.id') : null;

            if ($tenantId !== null) {
                $builder->where($builder->qualifyColumn('tenant_id'), $tenantId);
            }
        });
    }
}
