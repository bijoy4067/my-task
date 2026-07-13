<?php

namespace App\Support;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Resolves the two like-derived fields that PostResource exposes but the posts table cannot
 * answer on its own — `liked_by_me` and `likers_preview` (the overlapping reactor avatars).
 *
 * Both are resolved for a whole page at once. Asking per post — Likeable::isLikedBy() or
 * $post->likers() inside a loop — is an N+1, which is the whole reason this lives here
 * rather than in the resource.
 */
class PostLikes
{
    /** How many reactor avatars the card shows before the count badge takes over. */
    public const PREVIEW_LIMIT = 5;

    /**
     * @param  Collection<int, Post>  $posts
     */
    public static function hydrate(Collection $posts, ?User $user): void
    {
        self::markLikedBy($posts, $user);
        self::markLikersPreview($posts);
    }

    /**
     * @param  Collection<int, Post>  $posts
     */
    public static function markLikedBy(Collection $posts, ?User $user): void
    {
        $likedIds = ($user === null || $posts->isEmpty()) ? [] : DB::table('likes')
            ->where('user_id', $user->id)
            ->where('likeable_type', (new Post)->getMorphClass())
            ->whereIn('likeable_id', $posts->modelKeys())
            ->pluck('likeable_id')
            ->all();

        $posts->each(fn (Post $post) => $post->setAttribute(
            'liked_by_me', in_array($post->id, $likedIds, true)
        ));
    }

    /**
     * @param  Collection<int, Post>  $posts
     */
    public static function markLikersPreview(Collection $posts): void
    {
        $previews = $posts->isEmpty() ? [] : self::previewsFor($posts->modelKeys());

        $posts->each(fn (Post $post) => $post->setAttribute(
            'likers_preview', $previews[$post->id] ?? []
        ));
    }

    /**
     * The most recent PREVIEW_LIMIT likers of each post, as [post_id => [{id, name, avatar_url}]].
     *
     * @param  array<int, int>  $postIds
     * @return array<int, array<int, array{id: int, name: string, avatar_url: string|null}>>
     */
    private static function previewsFor(array $postIds): array
    {
        // A window function does the per-post "top 5" inside the database. Fetching every like
        // row and slicing in PHP would work, but it drags the full like list of a viral post
        // across the wire just to show five faces.
        $ranked = DB::table('likes')
            ->select('likeable_id', 'user_id')
            ->selectRaw('row_number() over (partition by likeable_id order by id desc) as rank')
            ->where('likeable_type', (new Post)->getMorphClass())
            ->whereIn('likeable_id', $postIds);

        $rows = DB::query()
            ->fromSub($ranked, 'ranked')
            ->where('rank', '<=', self::PREVIEW_LIMIT)
            ->get();

        // One more query resolves the avatars, since they live in the media table rather
        // than on users. Keyed by id so the loop below is a lookup, not a search.
        $users = User::query()
            ->with('media')
            ->whereIn('id', $rows->pluck('user_id')->unique())
            ->get()
            ->keyBy('id');

        $previews = [];

        foreach ($rows as $row) {
            $user = $users->get($row->user_id);

            if ($user === null) {
                continue;
            }

            $previews[$row->likeable_id][] = [
                'id' => $user->id,
                'name' => $user->name,
                'avatar_url' => $user->getFirstMediaUrl('avatar') ?: null,
            ];
        }

        return $previews;
    }
}
