<?php

namespace App\Models;

use App\Models\Concerns\Likeable;
use Database\Factories\CommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

#[Fillable(['body', 'parent_id'])]
class Comment extends Model implements HasMedia
{
    /** @use HasFactory<CommentFactory> */
    use HasFactory, InteractsWithMedia, Likeable;

    public function registerMediaCollections(): void
    {
        // Same reasoning as Post: a comment on a private post must not have its attachments
        // sitting at a guessable public URL, so they stream through MediaController behind
        // the owning post's policy.
        $this->addMediaCollection('images')->useDisk('local');

        // One voice note per comment — recording a second replaces the first, which is what
        // the composer's re-record does.
        $this->addMediaCollection('audio')->useDisk('local')->singleFile();
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }
}
