<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $video = $this->getFirstMedia('videos');
        $user = $request->user();

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'visibility' => $this->visibility,
            'created_at' => $this->created_at->toIso8601String(),

            'likes_count' => $this->likes_count,
            'comments_count' => $this->comments_count,
            // Set in bulk by the controller — never resolved per post, which would be an N+1.
            'liked_by_me' => (bool) $this->liked_by_me,

            'author' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'avatar_url' => $this->user->getFirstMediaUrl('avatar') ?: null,
            ],

            'images' => $this->getMedia('images')
                ->map(fn ($image) => [
                    'id' => $image->id,
                    'url' => route('media.show', $image),
                ])
                ->values(),
            'video_url' => $video ? route('media.show', $video) : null,

            'event' => $this->whenLoaded('event', fn () => $this->event ? [
                'starts_at' => $this->event->starts_at?->toIso8601String(),
                'ends_at' => $this->event->ends_at?->toIso8601String(),
                'location' => $this->event->location,
            ] : null),

            'permissions' => [
                'update' => $user?->can('update', $this->resource) ?? false,
                'delete' => $user?->can('delete', $this->resource) ?? false,
            ],
        ];
    }
}
