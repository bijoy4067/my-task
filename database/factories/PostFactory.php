<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    /**
     * Weighted so most posts are plain status/photo updates, with a smaller
     * tail of video/event/article — matches the composer's four buttons.
     */
    private const TYPE_WEIGHTS = [
        'status', 'status', 'status', 'status', 'status', 'status', 'status', 'status',
        'photo', 'photo', 'photo', 'photo', 'photo', 'photo',
        'video', 'video', 'video',
        'event', 'event',
        'article',
    ];

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => fake()->randomElement(self::TYPE_WEIGHTS),
            'body' => fake()->realText(fake()->numberBetween(40, 280)),
            'visibility' => 'public',
        ];
    }

    public function public(): static
    {
        return $this->state(fn (array $attributes) => ['visibility' => 'public']);
    }

    public function private(): static
    {
        return $this->state(fn (array $attributes) => ['visibility' => 'private']);
    }

    public function status(): static
    {
        return $this->state(fn (array $attributes) => ['type' => 'status']);
    }

    public function photo(): static
    {
        return $this->state(fn (array $attributes) => ['type' => 'photo']);
    }

    public function video(): static
    {
        return $this->state(fn (array $attributes) => ['type' => 'video']);
    }

    public function event(): static
    {
        return $this->state(fn (array $attributes) => ['type' => 'event']);
    }

    public function article(): static
    {
        return $this->state(fn (array $attributes) => ['type' => 'article']);
    }
}
