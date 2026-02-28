<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPER_ADMIN = 'super_admin';
    case MANAGER_PARENT = 'manager_parent';
    case MANAGER = 'manager';
    case RESELLER = 'reseller';
    case CUSTOMER = 'customer';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
