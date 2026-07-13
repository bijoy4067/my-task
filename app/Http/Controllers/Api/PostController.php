<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PostController extends Controller
{
    public function store(StorePostRequest $request)
    {
        $validated = $request->validated();

        $post = DB::transaction(function () use ($request, $validated) {
            $post = $request->user()->posts()->create([
                'type' => $validated['type'],
                'title' => $validated['title'] ?? null,
                'body' => $validated['body'] ?? null,
                'visibility' => $validated['visibility'],
            ]);

            if ($validated['type'] === 'event') {
                $post->event()->create([
                    'starts_at' => $validated['starts_at'],
                    'ends_at' => $validated['ends_at'] ?? null,
                    'location' => $validated['location'] ?? null,
                ]);
            }

            foreach ($request->file('images', []) as $image) {
                $post->addMedia($image)->toMediaCollection('images');
            }

            if ($request->hasFile('video')) {
                $post->addMediaFromRequest('video')->toMediaCollection('videos');
            }

            return $post;
        });

        $post->load(['user', 'media', 'event'])->setAttribute('liked_by_me', false);

        return PostResource::make($post)->response()->setStatusCode(201);
    }

    public function destroy(Post $post)
    {
        Gate::authorize('delete', $post);

        // Deleting the post cascades to comments (FK) and to media files (media library).
        $post->delete();

        return response()->noContent();
    }
}
