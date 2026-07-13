<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

class LikeSeeder extends Seeder
{
    /**
     * Seed likes scattered across posts, comments, and replies.
     */
    public function run(): void
    {
        $users = User::all();

        Post::all()->each(fn (Post $post) => $this->likeFrom($post, $users, max: 10));
        Comment::all()->each(fn (Comment $comment) => $this->likeFrom($comment, $users, max: 5));
    }

    private function likeFrom(Model $likeable, Collection $users, int $max): void
    {
        $count = fake()->numberBetween(0, min($max, $users->count()));

        $users->random($count)->each(fn (User $user) => Like::firstOrCreate([
            'likeable_type' => $likeable::class,
            'likeable_id' => $likeable->id,
            'user_id' => $user->id,
        ]));
    }
}
