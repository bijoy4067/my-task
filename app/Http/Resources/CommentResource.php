<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $audio = $this->getFirstMedia('audio');

        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'body' => $this->body,
            'created_at' => $this->created_at->toIso8601String(),

            // Attachments stream through MediaController rather than sitting on a public disk,
            // so a comment on a private post stays behind that post's policy.
            'images' => $this->getMedia('images')
                ->map(fn ($image) => [
                    'id' => $image->id,
                    'url' => route('media.show', $image),
                ])
                ->values(),
            'audio_url' => $audio ? route('media.show', $audio) : null,

            'likes_count' => $this->likes_count,
            'replies_count' => $this->replies_count,
            // Set in bulk by App\Support\Likes before serialization, exactly as posts do it —
            // resolving it here, per comment, would be an N+1 down the whole thread.
            'liked_by_me' => (bool) $this->liked_by_me,

            'author' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'avatar_url' => $this->user->getFirstMediaUrl('avatar') ?: null,
            ],

            // Only top-level comments carry these; a reply is never itself a parent.
            'replies' => self::collection($this->whenLoaded('replies')),

            'permissions' => [
                'update' => $user?->can('update', $this->resource) ?? false,
                'delete' => $user?->can('delete', $this->resource) ?? false,
            ],
        ];
    }
}
