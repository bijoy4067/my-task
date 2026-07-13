<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

// Everything else is handled client-side by the React app (see resources/js/Root.jsx).
Route::post('/api/register', [AuthController::class, 'register']);
Route::post('/api/login', [AuthController::class, 'login']);
Route::post('/api/logout', [AuthController::class, 'logout'])->middleware('auth');
Route::get('/api/user', [AuthController::class, 'user'])->middleware('auth');
// TODO: FeedController doesn't exist yet — re-enable once it's built.
// Route::get('/api/feed', [FeedController::class, 'index'])->middleware('auth');

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');