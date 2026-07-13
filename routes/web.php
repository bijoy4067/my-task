<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\PostController;
use Illuminate\Support\Facades\Route;

// Everything else is handled client-side by the React app (see resources/js/Root.jsx).
Route::post('/api/register', [AuthController::class, 'register']);
Route::post('/api/login', [AuthController::class, 'login']);
Route::post('/api/logout', [AuthController::class, 'logout'])->middleware('auth');
Route::get('/api/user', [AuthController::class, 'user'])->middleware('auth');

Route::middleware('auth')->group(function () {
    Route::get('/api/feed', [FeedController::class, 'index']);
    Route::post('/api/posts', [PostController::class, 'store'])->middleware('throttle:30,1');
    Route::delete('/api/posts/{post}', [PostController::class, 'destroy']);
    Route::get('/api/media/{media}', [MediaController::class, 'show'])->name('media.show');
});

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');