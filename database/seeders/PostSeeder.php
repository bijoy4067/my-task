<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

class PostSeeder extends Seeder
{
    /**
     * Seed the application's posts.
     */
    public function run(): void
    {
        $users = User::all();

        Post::factory()->count(32)->public()->recycle($users)->create();
        Post::factory()->count(8)->private()->recycle($users)->create();
    }
}
