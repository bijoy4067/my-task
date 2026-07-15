<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCommentRequest;
use App\Http\Requests\UpdateCommentRequest;
use App\Http\Resources\CommentResource;
use App\Models\Comment;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use App\Support\Likes;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CommentController extends Controller
{
    private const PER_PAGE = 5;

    /**
     * A post's thread: top-level comments newest first, each with its replies.
     *
     * Paging backwards through this is what "View N previous comments" does — the card shows
     * the newest few and walks the cursor into the older ones.
     */
    public function index(Request $request, Post $post)
    {
        Gate::authorize('view', $post);

        $validated = $request->validate([
            'cursor' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $limit = $validated['limit'] ?? self::PER_PAGE;

        $comments = $post->comments()
            ->whereNull('parent_id')
            ->with([
                'user.media',
                // The comment's own attachments — its images and voice note.
                'media',
                // Replies come back with their parent rather than per comment — one query for
                // the whole page. They are bounded: the thread is only ever one level deep,
                // so this cannot fan out the way an unbounded tree would.
                'replies' => fn ($query) => $query->with(['user.media', 'media'])->orderBy('id'),
            ])
            ->when(
                $validated['cursor'] ?? null,
                fn ($query, $cursor) => $query->where('id', '<', $cursor)
            )
            ->orderByDesc('id')
            ->limit($limit + 1)
            ->get();

        $hasMore = $comments->count() > $limit;
        $comments = $comments->take($limit);

        $this->markThreadLikedBy($comments, $request->user());

        return CommentResource::collection($comments)->additional([
            'meta' => [
                'next_cursor' => $hasMore ? $comments->last()->id : null,
            ],
        ]);
    }

    public function store(StoreCommentRequest $request, Post $post)
    {
        // Commenting on a post you cannot see would leak its existence.
        Gate::authorize('view', $post);

        $validated = $request->validated();

        $comment = DB::transaction(function () use ($request, $validated, $post) {
            // `post_id` and `user_id` are not fillable on Comment, so neither can be spoofed
            // through the request body — the relation and the authenticated user set them.
            $comment = new Comment([
                'body' => $validated['body'] ?? null,
                'parent_id' => $validated['parent_id'] ?? null,
            ]);

            $comment->user()->associate($request->user());
            $post->comments()->save($comment);

            // Both are read off the FormRequest, whose uploaded-file bag was already resolved
            // during validation. addMediaFromRequest() would instead go through the container's
            // original request and re-resolve every uploaded file — and by then the image
            // temp files have been moved, so re-wrapping them throws "file does not exist".
            foreach ($request->file('images', []) as $image) {
                $comment->addMedia($image)->toMediaCollection('images');
            }

            if ($audio = $request->file('audio')) {
                $comment->addMedia($audio)->toMediaCollection('audio');
            }

            // The card's "N Comment" counts the whole thread, replies included.
            $post->increment('comments_count');

            if ($comment->parent_id !== null) {
                Comment::whereKey($comment->parent_id)->increment('replies_count');
            }

            return $comment;
        });

        // The counters carry database defaults, which the freshly inserted model has never
        // read back — without this they serialize as null rather than 0.
        $comment->refresh();

        $this->markThreadLikedBy(new Collection([$comment]), $request->user());

        return CommentResource::make($comment->load(['user.media', 'media']))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateCommentRequest $request, Comment $comment)
    {
        Gate::authorize('update', $comment);

        $comment->update(['body' => $request->validated()['body']]);

        $this->markThreadLikedBy(new Collection([$comment]), $request->user());

        return CommentResource::make($comment->load(['user.media', 'media']));
    }

    public function destroy(Comment $comment)
    {
        Gate::authorize('delete', $comment);

        DB::transaction(function () use ($comment) {
            // Deleting a top-level comment takes its replies with it, via the FK cascade. A
            // cascade fires no model events, so nothing else will adjust the counters for
            // those rows — the post's total has to lose the whole subtree here, not just 1.
            $removed = 1 + $comment->replies_count;

            $ids = $comment->replies()->pluck('id')->push($comment->id);

            // Likes are polymorphic and so have no foreign key to cascade along. Left alone
            // they would outlive the comments they point at.
            Like::where('likeable_type', $comment->getMorphClass())
                ->whereIn('likeable_id', $ids)
                ->delete();

            $post = $comment->post;
            $post->decrement('comments_count', min($removed, $post->comments_count));

            if ($comment->parent_id !== null) {
                Comment::whereKey($comment->parent_id)
                    ->where('replies_count', '>', 0)
                    ->decrement('replies_count');
            }

            // The replies would go by cascade anyway, but a cascade is invisible to the media
            // library — their images and voice notes would be left on disk with no row
            // pointing at them. Deleting each reply as a model lets that cleanup run.
            $comment->replies->each->delete();

            $comment->delete();
        });

        return response()->noContent();
    }

    /**
     * Resolve `liked_by_me` for a page of comments *and* their replies in one pass — the
     * replies are likeable too, and asking per comment would be an N+1 down the thread.
     *
     * @param  Collection<int, Comment>  $comments
     */
    private function markThreadLikedBy(Collection $comments, ?User $user): void
    {
        $thread = $comments->concat(
            $comments->flatMap(fn (Comment $comment) => $comment->relationLoaded('replies')
                ? $comment->replies
                : [])
        );

        Likes::markLikedBy(new Collection($thread->all()), $user);
    }
}
