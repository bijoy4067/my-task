<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Support\PostLikes;
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

        // Resolves `liked_by_me` and the reactor avatar row for the whole page in two queries.
        PostLikes::hydrate($posts, $user);

        return PostResource::collection($posts)->additional([
            'meta' => [
                'next_cursor' => $hasMore ? $posts->last()->id : null,
            ],
        ]);
    }
}
