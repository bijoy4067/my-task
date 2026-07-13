<?php

namespace App\Models;

use App\Models\Concerns\Likeable;
use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

#[Fillable(['type', 'title', 'body', 'visibility'])]
class Post extends Model implements HasMedia
{
    /** @use HasFactory<PostFactory> */
    use HasFactory, InteractsWithMedia, Likeable;

    public const TYPES = ['status', 'photo', 'video', 'event', 'article'];

    public const VISIBILITIES = ['public', 'private'];

    public function registerMediaCollections(): void
    {
        // A private post's media must not sit at a publicly guessable URL, so it lives on a
        // non-web-accessible disk and is streamed through MediaController behind the policy.
        $this->addMediaCollection('images')->useDisk('local');
        $this->addMediaCollection('videos')->useDisk('local')->singleFile();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function event(): HasOne
    {
        return $this->hasOne(PostEvent::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $query) use ($user) {
            $query->where('visibility', 'public')->orWhere('user_id', $user->id);
        });
    }
}
