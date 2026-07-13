<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\LikeController;
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
    Route::get('/api/posts/{post}', [PostController::class, 'show']);
    // PUT can't carry $_FILES on its own — the client spoofs it with a POST body
    // that sets _method=PUT, and Laravel's MethodOverride middleware routes it here.
    Route::put('/api/posts/{post}', [PostController::class, 'update'])->middleware('throttle:30,1');
    Route::delete('/api/posts/{post}', [PostController::class, 'destroy']);

    // Liking is a toggle, so it gets a looser throttle than posting — tapping the button on
    // and off a few times is normal use, not abuse.
    Route::get('/api/posts/{post}/likes', [LikeController::class, 'index']);
    Route::post('/api/posts/{post}/like', [LikeController::class, 'store'])->middleware('throttle:60,1');
    Route::delete('/api/posts/{post}/like', [LikeController::class, 'destroy'])->middleware('throttle:60,1');
    Route::post('/api/comments/{comment}/like', [LikeController::class, 'storeComment'])->middleware('throttle:60,1');
    Route::delete('/api/comments/{comment}/like', [LikeController::class, 'destroyComment'])->middleware('throttle:60,1');

    Route::get('/api/media/{media}', [MediaController::class, 'show'])->name('media.show');
});

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');