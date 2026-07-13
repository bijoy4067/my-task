<?php

use Illuminate\Support\Facades\Route;

// Everything else is handled client-side by the React app (see resources/js/Root.jsx).
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');