<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Resolves `liked_by_me` for a page of anything that uses the Likeable trait — posts today,
 * comments and their replies as well.
 *
 * The trait's own isLikedBy() answers for a single model, which is exactly the wrong shape
 * for a list: calling it in a loop is an N+1. This asks once for the whole page.
 */
class Likes
{
    /**
     * @param  Collection<int, Model>  $likeables  All of one type — posts or comments, not both.
     */
    public static function markLikedBy(Collection $likeables, ?User $user): void
    {
        if ($likeables->isEmpty()) {
            return;
        }

        $likedIds = $user === null ? [] : DB::table('likes')
            ->where('user_id', $user->id)
            ->where('likeable_type', $likeables->first()->getMorphClass())
            ->whereIn('likeable_id', $likeables->modelKeys())
            ->pluck('likeable_id')
            ->all();

        $likeables->each(fn (Model $likeable) => $likeable->setAttribute(
            'liked_by_me', in_array($likeable->getKey(), $likedIds, true)
        ));
    }
}
