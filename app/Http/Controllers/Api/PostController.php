<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PostController extends Controller
{
    public function show(Post $post)
    {
        Gate::authorize('view', $post);

        $post->load(['user', 'media', 'event'])
            ->setAttribute('liked_by_me', $post->isLikedBy(request()->user()));

        return PostResource::make($post);
    }

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

    public function update(UpdatePostRequest $request, Post $post)
    {
        Gate::authorize('update', $post);

        $validated = $request->validated();

        DB::transaction(function () use ($request, $validated, $post) {
            // The type never changes on edit, only the content — title/body/visibility
            // always get overwritten with whatever the form last held.
            $post->update([
                'title' => $validated['title'] ?? null,
                'body' => $validated['body'] ?? null,
                'visibility' => $validated['visibility'],
            ]);

            if ($post->type === 'event') {
                $post->event()->updateOrCreate([], [
                    'starts_at' => $validated['starts_at'],
                    'ends_at' => $validated['ends_at'] ?? null,
                    'location' => $validated['location'] ?? null,
                ]);
            }

            // Images the user unchecked in the gallery are deleted one at a time — scoping
            // the lookup through the post's own media means a foreign or stale id is a no-op,
            // not an error.
            foreach ($validated['remove_images'] ?? [] as $mediaId) {
                $post->media()->whereKey($mediaId)->where('collection_name', 'images')->first()?->delete();
            }

            foreach ($request->file('images', []) as $image) {
                $post->addMedia($image)->toMediaCollection('images');
            }

            // A replacement video or an explicit removal both clear the old one first —
            // the collection is `singleFile()`, so leaving it in place would fight the new upload.
            if (($validated['remove_video'] ?? false) || $request->hasFile('video')) {
                $post->clearMediaCollection('videos');
            }

            if ($request->hasFile('video')) {
                $post->addMediaFromRequest('video')->toMediaCollection('videos');
            }
        });

        $post->load(['user', 'media', 'event'])
            ->setAttribute('liked_by_me', $post->isLikedBy($request->user()));

        return PostResource::make($post);
    }

    public function destroy(Post $post)
    {
        Gate::authorize('delete', $post);

        // Deleting the post cascades to comments (FK) and to media files (media library).
        $post->delete();

        return response()->noContent();
    }
}
