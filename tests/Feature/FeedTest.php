<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FeedTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Keep uploaded fixtures out of the real storage directory.
        Storage::fake('local');
    }

    public function test_the_feed_is_closed_to_guests(): void
    {
        $this->getJson('/api/feed')->assertUnauthorized();
        $this->postJson('/api/posts', [])->assertUnauthorized();
    }

    public function test_it_lists_posts_newest_first(): void
    {
        $author = User::factory()->create();
        $older = Post::factory()->public()->for($author)->create();
        $newer = Post::factory()->public()->for($author)->create();

        $response = $this->actingAs(User::factory()->create())->getJson('/api/feed');

        $response->assertOk();
        $this->assertSame(
            [$newer->id, $older->id],
            array_column($response->json('data'), 'id')
        );
    }

    public function test_private_posts_are_visible_only_to_their_author(): void
    {
        $author = User::factory()->create();
        $private = Post::factory()->private()->for($author)->create();

        $stranger = User::factory()->create();

        $this->actingAs($stranger)->getJson('/api/feed')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($author)->getJson('/api/feed')
            ->assertOk()
            ->assertJsonPath('data.0.id', $private->id);
    }

    public function test_it_pages_through_the_feed_with_a_cursor(): void
    {
        Post::factory()->public()->count(3)->create();
        $user = User::factory()->create();

        $first = $this->actingAs($user)->getJson('/api/feed?limit=2')->assertOk();
        $this->assertCount(2, $first->json('data'));

        $cursor = $first->json('meta.next_cursor');
        $this->assertNotNull($cursor);

        $second = $this->actingAs($user)->getJson("/api/feed?limit=2&cursor={$cursor}")->assertOk();
        $this->assertCount(1, $second->json('data'));
        $this->assertNull($second->json('meta.next_cursor'));
    }

    public function test_it_creates_a_photo_post_with_several_images(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/api/posts', [
            'type' => 'photo',
            'visibility' => 'public',
            'body' => 'Look at these',
            'images' => [
                UploadedFile::fake()->image('one.jpg'),
                UploadedFile::fake()->image('two.jpg'),
                UploadedFile::fake()->image('three.jpg'),
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', 'photo')
            ->assertJsonPath('data.author.id', $user->id)
            ->assertJsonCount(3, 'data.images');

        $this->assertSame(3, Post::query()->sole()->getMedia('images')->count());
    }

    public function test_it_rejects_more_than_ten_images(): void
    {
        $images = array_fill(0, 11, UploadedFile::fake()->image('spam.jpg'));

        $this->actingAs(User::factory()->create())
            ->post('/api/posts', [
                'type' => 'photo',
                'visibility' => 'public',
                'images' => $images,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images');
    }

    public function test_it_rejects_a_non_image_upload(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/api/posts', [
                'type' => 'photo',
                'visibility' => 'public',
                'images' => [UploadedFile::fake()->create('payload.php', 10)],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images.0');
    }

    public function test_it_rejects_an_image_extension_whose_content_type_disagrees(): void
    {
        // An image extension is not enough on its own: the content type has to line up too.
        // (Content sniffing itself can't be exercised here — a faked upload reports whatever
        // MIME type it is handed rather than one guessed from its bytes.)
        $this->actingAs(User::factory()->create())
            ->post('/api/posts', [
                'type' => 'photo',
                'visibility' => 'public',
                'images' => [UploadedFile::fake()->create('shell.jpg', 10, 'text/x-php')],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images.0');
    }

    public function test_it_rejects_a_video_with_a_disallowed_extension(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/api/posts', [
                'type' => 'video',
                'visibility' => 'public',
                'video' => UploadedFile::fake()->create('clip.avi', 200, 'video/x-msvideo'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('video');
    }

    public function test_an_event_can_carry_a_cover_image(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/api/posts', [
            'type' => 'event',
            'visibility' => 'public',
            'title' => 'Launch party',
            'starts_at' => '2026-08-01 18:00:00',
            'images' => [UploadedFile::fake()->image('cover.jpg')],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', 'event')
            ->assertJsonCount(1, 'data.images');

        $this->assertDatabaseHas('post_events', ['post_id' => $response->json('data.id')]);
    }

    public function test_it_creates_an_event_post_with_its_own_row(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/posts', [
            'type' => 'event',
            'visibility' => 'public',
            'title' => 'Launch party',
            'starts_at' => '2026-08-01 18:00:00',
            'location' => 'Dhaka',
        ])->assertCreated();

        $this->assertDatabaseHas('post_events', ['location' => 'Dhaka']);
    }

    public function test_it_rejects_a_photo_post_with_no_image(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/posts', ['type' => 'photo', 'visibility' => 'public'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('images');
    }

    public function test_only_the_author_can_delete_a_post(): void
    {
        $post = Post::factory()->public()->create();

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/posts/{$post->id}")
            ->assertForbidden();

        $this->actingAs($post->user)
            ->deleteJson("/api/posts/{$post->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }

    public function test_a_private_posts_media_is_not_served_to_others(): void
    {
        $author = User::factory()->create();

        $created = $this->actingAs($author)->post('/api/posts', [
            'type' => 'photo',
            'visibility' => 'private',
            'images' => [UploadedFile::fake()->image('secret.jpg')],
        ])->assertCreated();

        $url = $created->json('data.images.0.url');

        $this->actingAs($author)->get($url)->assertOk();
        $this->actingAs(User::factory()->create())->get($url)->assertForbidden();
    }
}
