<?php

use App\Models\Comment;
use App\Models\Post;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The counter columns were added denormalized but nothing ever wrote to them, so every
     * row still reads 0 while the `likes` and `comments` tables hold the real rows. The
     * controllers maintain the counters from here on; this squares the existing data with
     * them once, so the feed stops rendering zeros over seeded likes and comments.
     */
    public function up(): void
    {
        // Correlated subqueries rather than a read-then-write loop: one statement per table,
        // correct no matter how many rows exist. The morph type is bound rather than
        // interpolated — the class name contains backslashes, which MySQL would treat as
        // escapes inside a string literal.
        DB::statement(
            'update posts set
                likes_count = (select count(*) from likes
                    where likes.likeable_type = ? and likes.likeable_id = posts.id),
                comments_count = (select count(*) from comments
                    where comments.post_id = posts.id)',
            [(new Post)->getMorphClass()]
        );

        DB::statement(
            'update comments set
                likes_count = (select count(*) from likes
                    where likes.likeable_type = ? and likes.likeable_id = comments.id),
                replies_count = (select count(*) from comments as replies
                    where replies.parent_id = comments.id)',
            [(new Comment)->getMorphClass()]
        );
    }

    /**
     * Zeroing is the only honest inverse — the pre-migration state was "0 everywhere",
     * and the real like/comment rows are untouched either way.
     */
    public function down(): void
    {
        DB::table('posts')->update(['likes_count' => 0, 'comments_count' => 0]);
        DB::table('comments')->update(['likes_count' => 0, 'replies_count' => 0]);
    }
};
