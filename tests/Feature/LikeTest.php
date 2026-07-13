<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LikeTest extends TestCase
{
    use RefreshDatabase;

    public function test_liking_is_closed_to_guests(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->postJson("/api/posts/{$post->id}/like")->assertUnauthorized();
        $this->deleteJson("/api/posts/{$post->id}/like")->assertUnauthorized();
        $this->getJson("/api/posts/{$post->id}/likes")->assertUnauthorized();
    }

    public function test_it_likes_and_unlikes_a_post(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($user)->postJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('likes_count', 1)
            ->assertJsonPath('liked_by_me', true)
            ->assertJsonPath('likers_preview.0.id', $user->id);

        $this->assertSame(1, $post->fresh()->likes_count);
        $this->assertSame(1, $post->likes()->count());

        $this->actingAs($user)->deleteJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('likes_count', 0)
            ->assertJsonPath('liked_by_me', false)
            ->assertJsonPath('likers_preview', []);

        $this->assertSame(0, $post->fresh()->likes_count);
        $this->assertSame(0, $post->likes()->count());
    }

    /**
     * The unique index makes the second like a no-op at the row level; the counter has to
     * agree. A double-tap that inflates likes_count is the whole failure mode here.
     */
    public function test_liking_twice_does_not_inflate_the_counter(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($user)->postJson("/api/posts/{$post->id}/like")->assertOk();
        $this->actingAs($user)->postJson("/api/posts/{$post->id}/like")->assertOk();

        $this->assertSame(1, $post->fresh()->likes_count);
        $this->assertSame(1, $post->likes()->count());
    }

    public function test_unliking_what_was_never_liked_does_not_drive_the_counter_negative(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($user)->deleteJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('likes_count', 0);

        $this->assertSame(0, $post->fresh()->likes_count);
    }

    public function test_a_private_post_cannot_be_liked_by_a_stranger(): void
    {
        $post = Post::factory()->private()->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/posts/{$post->id}/like")
            ->assertForbidden();

        $this->assertSame(0, $post->fresh()->likes_count);
    }

    public function test_it_lists_the_people_who_liked_a_post_newest_first(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        $first = User::factory()->create();
        $second = User::factory()->create();

        $this->actingAs($first)->postJson("/api/posts/{$post->id}/like")->assertOk();
        $this->actingAs($second)->postJson("/api/posts/{$post->id}/like")->assertOk();

        $response = $this->actingAs($first)->getJson("/api/posts/{$post->id}/likes")->assertOk();

        $this->assertSame(
            [$second->id, $first->id],
            array_column($response->json('data'), 'id')
        );
        $this->assertNull($response->json('meta.next_cursor'));
    }

    public function test_the_likers_list_pages_with_a_cursor(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();

        User::factory()->count(3)->create()->each(
            fn (User $user) => $this->actingAs($user)->postJson("/api/posts/{$post->id}/like")->assertOk()
        );

        $viewer = User::factory()->create();

        $page = $this->actingAs($viewer)->getJson("/api/posts/{$post->id}/likes?limit=2")->assertOk();
        $this->assertCount(2, $page->json('data'));
        $this->assertNotNull($cursor = $page->json('meta.next_cursor'));

        $next = $this->actingAs($viewer)->getJson("/api/posts/{$post->id}/likes?limit=2&cursor={$cursor}")->assertOk();
        $this->assertCount(1, $next->json('data'));
        $this->assertNull($next->json('meta.next_cursor'));
    }

    /**
     * The card only has room for five faces, so the resource must not hand back more —
     * however many people actually liked the post.
     */
    public function test_the_feed_previews_at_most_five_likers_per_post(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();

        User::factory()->count(7)->create()->each(
            fn (User $user) => $this->actingAs($user)->postJson("/api/posts/{$post->id}/like")->assertOk()
        );

        $response = $this->actingAs(User::factory()->create())->getJson('/api/feed')->assertOk();

        $this->assertSame(7, $response->json('data.0.likes_count'));
        $this->assertCount(5, $response->json('data.0.likers_preview'));
        $this->assertFalse($response->json('data.0.liked_by_me'));
    }

    public function test_the_feed_reports_whether_the_viewer_liked_each_post(): void
    {
        $viewer = User::factory()->create();
        $liked = Post::factory()->public()->for(User::factory())->create();
        Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($viewer)->postJson("/api/posts/{$liked->id}/like")->assertOk();

        $response = $this->actingAs($viewer)->getJson('/api/feed')->assertOk();

        $byId = collect($response->json('data'))->keyBy('id');
        $this->assertTrue($byId[$liked->id]['liked_by_me']);
        $this->assertFalse($byId->except($liked->id)->first()['liked_by_me']);
    }

    public function test_it_likes_and_unlikes_a_comment(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();

        $this->actingAs($user)->postJson("/api/comments/{$comment->id}/like")
            ->assertOk()
            ->assertJsonPath('likes_count', 1)
            ->assertJsonPath('liked_by_me', true);

        $this->assertSame(1, $comment->fresh()->likes_count);

        $this->actingAs($user)->deleteJson("/api/comments/{$comment->id}/like")
            ->assertOk()
            ->assertJsonPath('likes_count', 0)
            ->assertJsonPath('liked_by_me', false);

        $this->assertSame(0, $comment->fresh()->likes_count);
    }

    public function test_a_comment_on_an_invisible_post_cannot_be_liked(): void
    {
        $post = Post::factory()->private()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/comments/{$comment->id}/like")
            ->assertForbidden();

        $this->assertSame(0, $comment->fresh()->likes_count);
    }
}
