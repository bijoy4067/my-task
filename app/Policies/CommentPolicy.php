<?php

namespace App\Policies;

use App\Models\Comment;
use App\Models\User;

class CommentPolicy
{
    public function update(User $user, Comment $comment): bool
    {
        return $comment->user_id === $user->id;
    }

    /**
     * Your own comment is yours to remove — and so is anyone's comment on your own post.
     * Moderating your post is the reason the second half exists; without it an author has
     * no way to clear something off their own timeline.
     */
    public function delete(User $user, Comment $comment): bool
    {
        return $comment->user_id === $user->id
            || $comment->post->user_id === $user->id;
    }
}
