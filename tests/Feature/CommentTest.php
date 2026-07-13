<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommentTest extends TestCase
{
    use RefreshDatabase;

    public function test_commenting_is_closed_to_guests(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->getJson("/api/posts/{$post->id}/comments")->assertUnauthorized();
        $this->postJson("/api/posts/{$post->id}/comments", ['body' => 'Hi'])->assertUnauthorized();
    }

    public function test_it_posts_a_comment_and_moves_the_post_counter(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($user)
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'First!'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'First!')
            ->assertJsonPath('data.parent_id', null)
            ->assertJsonPath('data.author.id', $user->id)
            ->assertJsonPath('data.likes_count', 0)
            ->assertJsonPath('data.permissions.update', true);

        $this->assertSame(1, $post->fresh()->comments_count);
        $this->assertSame(1, $post->comments()->count());
    }

    public function test_the_body_is_required(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/posts/{$post->id}/comments", ['body' => ''])
            ->assertJsonValidationErrorFor('body');

        $this->assertSame(0, $post->fresh()->comments_count);
    }

    public function test_a_post_you_cannot_see_cannot_be_commented_on(): void
    {
        $post = Post::factory()->private()->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Sneaking in'])
            ->assertForbidden();

        $this->assertSame(0, $post->fresh()->comments_count);
    }

    public function test_it_replies_to_a_comment(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();
        $parent = Comment::factory()->for($post)->for(User::factory())->create();

        $this->actingAs($user)
            ->postJson("/api/posts/{$post->id}/comments", [
                'body' => 'Replying',
                'parent_id' => $parent->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.parent_id', $parent->id);

        $this->assertSame(1, $parent->fresh()->replies_count);
        // A reply is still a comment on the post, so the card's "N Comment" counts it.
        $this->assertSame(1, $post->fresh()->comments_count);
    }

    public function test_a_reply_cannot_cross_posts(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        $elsewhere = Post::factory()->public()->for(User::factory())->create();
        $parent = Comment::factory()->for($elsewhere)->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->postJson("/api/posts/{$post->id}/comments", [
                'body' => 'Wrong thread',
                'parent_id' => $parent->id,
            ])
            ->assertJsonValidationErrorFor('parent_id');

        $this->assertSame(0, $post->fresh()->comments_count);
    }

    public function test_a_reply_cannot_be_replied_to(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        $parent = Comment::factory()->for($post)->for(User::factory())->create();
        $reply = Comment::factory()->for($post)->for(User::factory())->create(['parent_id' => $parent->id]);

        $this->actingAs(User::factory()->create())
            ->postJson("/api/posts/{$post->id}/comments", [
                'body' => 'Too deep',
                'parent_id' => $reply->id,
            ])
            ->assertJsonValidationErrorFor('parent_id');
    }

    public function test_it_lists_a_thread_newest_first_with_replies_nested(): void
    {
        $viewer = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $older = Comment::factory()->for($post)->for(User::factory())->create();
        $newer = Comment::factory()->for($post)->for(User::factory())->create();
        $reply = Comment::factory()->for($post)->for(User::factory())->create(['parent_id' => $older->id]);

        $response = $this->actingAs($viewer)->getJson("/api/posts/{$post->id}/comments")->assertOk();

        // Only top-level comments occupy the list; the reply hangs off its parent.
        $this->assertSame([$newer->id, $older->id], array_column($response->json('data'), 'id'));
        $this->assertSame([$reply->id], array_column($response->json('data.1.replies'), 'id'));
        $this->assertSame([], $response->json('data.0.replies'));
    }

    public function test_the_thread_pages_with_a_cursor(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        Comment::factory()->count(3)->for($post)->for(User::factory())->create();

        $viewer = User::factory()->create();

        $page = $this->actingAs($viewer)->getJson("/api/posts/{$post->id}/comments?limit=2")->assertOk();
        $this->assertCount(2, $page->json('data'));
        $this->assertNotNull($cursor = $page->json('meta.next_cursor'));

        $next = $this->actingAs($viewer)
            ->getJson("/api/posts/{$post->id}/comments?limit=2&cursor={$cursor}")
            ->assertOk();

        $this->assertCount(1, $next->json('data'));
        $this->assertNull($next->json('meta.next_cursor'));
    }

    public function test_the_thread_reports_which_comments_the_viewer_liked(): void
    {
        $viewer = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();
        $reply = Comment::factory()->for($post)->for(User::factory())->create(['parent_id' => $comment->id]);

        $this->actingAs($viewer)->postJson("/api/comments/{$reply->id}/like")->assertOk();

        $response = $this->actingAs($viewer)->getJson("/api/posts/{$post->id}/comments")->assertOk();

        $this->assertFalse($response->json('data.0.liked_by_me'));
        $this->assertTrue($response->json('data.0.replies.0.liked_by_me'));
        $this->assertSame(1, $response->json('data.0.replies.0.likes_count'));
    }

    public function test_only_the_author_can_edit_a_comment(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->putJson("/api/comments/{$comment->id}", ['body' => 'Hijacked'])
            ->assertForbidden();

        $this->actingAs($comment->user)
            ->putJson("/api/comments/{$comment->id}", ['body' => 'Edited'])
            ->assertOk()
            ->assertJsonPath('data.body', 'Edited');
    }

    public function test_the_post_author_can_delete_a_comment_on_their_own_post(): void
    {
        $author = User::factory()->create();
        $post = Post::factory()->public()->for($author)->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();
        $post->increment('comments_count');

        $this->actingAs($author)->deleteJson("/api/comments/{$comment->id}")->assertNoContent();

        $this->assertModelMissing($comment);
        $this->assertSame(0, $post->fresh()->comments_count);
    }

    public function test_a_stranger_cannot_delete_someone_elses_comment(): void
    {
        $post = Post::factory()->public()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for(User::factory())->create();

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/comments/{$comment->id}")
            ->assertForbidden();

        $this->assertModelExists($comment);
    }

    /**
     * The replies go with the parent by FK cascade, which fires no model events — so the
     * post's counter has to lose the whole subtree here, not just the one row.
     */
    public function test_deleting_a_comment_takes_its_replies_out_of_the_post_counter(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $parent = $this->actingAs($user)
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Parent'])
            ->json('data.id');

        foreach (['One', 'Two'] as $body) {
            $this->actingAs($user)->postJson("/api/posts/{$post->id}/comments", [
                'body' => $body,
                'parent_id' => $parent,
            ])->assertCreated();
        }

        $this->assertSame(3, $post->fresh()->comments_count);

        $this->actingAs($user)->deleteJson("/api/comments/{$parent}")->assertNoContent();

        $this->assertSame(0, $post->fresh()->comments_count);
        $this->assertSame(0, $post->comments()->count());
    }

    public function test_deleting_a_reply_gives_its_parent_back_a_reply_slot(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $parent = Comment::factory()->for($post)->for($user)->create();
        $post->increment('comments_count');

        $reply = $this->actingAs($user)->postJson("/api/posts/{$post->id}/comments", [
            'body' => 'A reply',
            'parent_id' => $parent->id,
        ])->json('data.id');

        $this->assertSame(1, $parent->fresh()->replies_count);

        $this->actingAs($user)->deleteJson("/api/comments/{$reply}")->assertNoContent();

        $this->assertSame(0, $parent->fresh()->replies_count);
        $this->assertSame(1, $post->fresh()->comments_count);
    }

    /**
     * Likes are polymorphic, so no foreign key cascades them away with the comment.
     */
    public function test_deleting_a_comment_clears_the_likes_pointing_at_it(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();
        $comment = Comment::factory()->for($post)->for($user)->create();
        $post->increment('comments_count');

        $this->actingAs(User::factory()->create())
            ->postJson("/api/comments/{$comment->id}/like")
            ->assertOk();

        $this->assertSame(1, Like::where('likeable_type', Comment::class)->count());

        $this->actingAs($user)->deleteJson("/api/comments/{$comment->id}")->assertNoContent();

        $this->assertSame(0, Like::where('likeable_type', Comment::class)->count());
    }

    public function test_the_feed_reports_the_comment_count(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->public()->for(User::factory())->create();

        $this->actingAs($user)
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Counted'])
            ->assertCreated();

        $this->actingAs($user)->getJson('/api/feed')
            ->assertOk()
            ->assertJsonPath('data.0.comments_count', 1);
    }
}
