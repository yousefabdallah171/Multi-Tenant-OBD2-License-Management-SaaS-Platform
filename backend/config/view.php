<?php

return [

    /*
    |--------------------------------------------------------------------------
    | View Storage Paths
    |--------------------------------------------------------------------------
    |
    | Most applications typically store template files within a dedicated
    | resources/views directory. This array allows the framework to know
    | where to look when resolving Blade and other view files.
    |
    */

    'paths' => [
        resource_path('views'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Compiled View Path
    |--------------------------------------------------------------------------
    |
    | Blade templates are compiled to plain PHP before rendering. Using
    | storage_path here keeps the path valid even if the directory has
    | not been created yet on a fresh local clone.
    |
    */

    'compiled' => env(
        'VIEW_COMPILED_PATH',
        storage_path('framework/views')
    ),

];
