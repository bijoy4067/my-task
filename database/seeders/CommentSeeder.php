<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

class CommentSeeder extends Seeder
{
    /**
     * Seed comments and replies across the seeded posts.
     */
    public function run(): void
    {
        $users = User::all();

        Post::all()->each(function (Post $post) use ($users) {
            if (! fake()->boolean(85)) {
                return; // ~15% of posts get no comments, for realism
            }

            $comments = Comment::factory()
                ->count(fake()->numberBetween(1, 5))
                ->for($post)
                ->recycle($users)
                ->create();

            $comments->each(function (Comment $comment) use ($users) {
                if (fake()->boolean(40)) {
                    Comment::factory()
                        ->count(fake()->numberBetween(1, 3))
                        ->replyTo($comment)
                        ->recycle($users)
                        ->create();
                }
            });
        });
    }
}
