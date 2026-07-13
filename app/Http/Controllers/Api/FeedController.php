<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    private const PER_PAGE = 10;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'cursor' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $user = $request->user();
        $limit = $validated['limit'] ?? self::PER_PAGE;

        // Keyset pagination: `id < cursor` seeks straight to the page instead of counting
        // past every earlier row the way OFFSET does. `id` sorts like `created_at` but is narrower.
        $posts = Post::query()
            ->visibleTo($user)
            ->with(['user', 'media', 'event'])
            ->when($validated['cursor'] ?? null, fn ($query, $cursor) => $query->where('id', '<', $cursor))
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        $hasMore = $posts->count() > $limit;
        $posts = $posts->take($limit);

        self::markLikedBy($posts, $user);

        return PostResource::collection($posts)->additional([
            'meta' => [
                'next_cursor' => $hasMore ? $posts->last()->id : null,
            ],
        ]);
    }

    /**
     * Resolve "did I like this?" for a whole page in one query. Calling
     * Likeable::isLikedBy() per post inside a loop would be an N+1.
     *
     * @param  Collection<int, Post>  $posts
     */
    public static function markLikedBy(Collection $posts, User $user): void
    {
        $likedIds = $posts->isEmpty() ? [] : Like::query()
            ->where('user_id', $user->id)
            ->where('likeable_type', Post::class)
            ->whereIn('likeable_id', $posts->pluck('id'))
            ->pluck('likeable_id')
            ->all();

        $posts->each(fn (Post $post) => $post->setAttribute(
            'liked_by_me', in_array($post->id, $likedIds, true)
        ));
    }
}
