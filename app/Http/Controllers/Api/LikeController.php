<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use App\Support\PostLikes;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class LikeController extends Controller
{
    private const PER_PAGE = 20;

    /**
     * The people who liked a post — backs the modal behind the reactor avatar row.
     */
    public function index(Request $request, Post $post)
    {
        Gate::authorize('view', $post);

        $validated = $request->validate([
            'cursor' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $limit = $validated['limit'] ?? self::PER_PAGE;

        // Cursor on `likes.id`, not `users.id` — the list is ordered by when the like
        // happened, so the like row is what the keyset has to seek on. `likers()` is the
        // MorphToMany the Likeable trait already provides; the pivot id comes along with it.
        $likers = $post->likers()
            ->with('media')
            ->when(
                $validated['cursor'] ?? null,
                fn ($query, $cursor) => $query->where('likes.id', '<', $cursor)
            )
            ->orderByDesc('likes.id')
            ->limit($limit + 1)
            ->get(['users.id', 'users.name', 'likes.id as like_id']);

        $hasMore = $likers->count() > $limit;
        $likers = $likers->take($limit);

        return response()->json([
            'data' => $likers->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar_url' => $user->getFirstMediaUrl('avatar') ?: null,
            ])->values(),
            'meta' => [
                'next_cursor' => $hasMore ? $likers->last()->like_id : null,
            ],
        ]);
    }

    public function store(Request $request, Post $post)
    {
        // You cannot like what you cannot see — a private post is off limits to everyone
        // but its author, exactly as the feed already enforces.
        Gate::authorize('view', $post);

        $this->like($post, $request->user()->id);

        return response()->json($this->postState($post, $request));
    }

    public function destroy(Request $request, Post $post)
    {
        Gate::authorize('view', $post);

        $this->unlike($post, $request->user()->id);

        return response()->json($this->postState($post, $request));
    }

    public function storeComment(Request $request, Comment $comment)
    {
        Gate::authorize('view', $comment->post);

        $this->like($comment, $request->user()->id);

        return response()->json([
            'likes_count' => $comment->refresh()->likes_count,
            'liked_by_me' => true,
        ]);
    }

    public function destroyComment(Request $request, Comment $comment)
    {
        Gate::authorize('view', $comment->post);

        $this->unlike($comment, $request->user()->id);

        return response()->json([
            'likes_count' => $comment->refresh()->likes_count,
            'liked_by_me' => false,
        ]);
    }

    /**
     * Add a like and move the denormalized counter with it, in lockstep.
     *
     * The unique index on (likeable_type, likeable_id, user_id) makes a second like from the
     * same user a no-op rather than a duplicate row — so the counter must only move when a
     * row was actually inserted. Without that check a double-click inflates the count forever.
     */
    private function like(Model $likeable, int $userId): void
    {
        DB::transaction(function () use ($likeable, $userId) {
            $like = $likeable->likes()->firstOrCreate(['user_id' => $userId]);

            if ($like->wasRecentlyCreated) {
                $likeable->increment('likes_count');
            }
        });
    }

    /**
     * Remove a like, decrementing only if a row was really deleted — `likes_count` is an
     * unsigned column, so an unmatched unlike would otherwise drive it below zero.
     */
    private function unlike(Model $likeable, int $userId): void
    {
        DB::transaction(function () use ($likeable, $userId) {
            $deleted = $likeable->likes()->where('user_id', $userId)->delete();

            if ($deleted > 0) {
                $likeable->decrement('likes_count');
            }
        });
    }

    /**
     * The post's like state as the card needs to render it — returned from the toggle so the
     * client reconciles against server truth instead of trusting its optimistic guess.
     */
    private function postState(Post $post, Request $request): array
    {
        $post->refresh();

        PostLikes::hydrate(new Collection([$post]), $request->user());

        return [
            'likes_count' => $post->likes_count,
            'liked_by_me' => (bool) $post->liked_by_me,
            'likers_preview' => $post->likers_preview,
        ];
    }
}
