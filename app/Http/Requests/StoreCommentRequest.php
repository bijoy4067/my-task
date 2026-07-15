<?php

namespace App\Http\Requests;

use App\Models\Comment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreCommentRequest extends FormRequest
{
    public const MAX_BODY = 2000;

    public const MAX_IMAGES = 4;

    /** 5 MB per image, matching a post's. */
    public const MAX_IMAGE_KB = 5120;

    /** 10 MB of voice note — several minutes at the bitrate MediaRecorder produces. */
    public const MAX_AUDIO_KB = 10240;

    public function rules(): array
    {
        $hasAttachment = $this->hasFile('images') || $this->hasFile('audio');

        return [
            // A picture or a voice note says enough on its own — but an entirely empty
            // comment is still nothing at all.
            'body' => [Rule::requiredIf(! $hasAttachment), 'nullable', 'string', 'max:' . self::MAX_BODY],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],

            // Three layers on every upload, as on a post: `extensions` checks the client
            // filename, `mimes` checks the guessed extension against the sniffed content, and
            // `mimetypes` pins the real type. A .php renamed to .jpg fails all the same.
            'images' => ['nullable', 'array', 'max:' . self::MAX_IMAGES],
            'images.*' => [
                'image',
                'extensions:jpg,jpeg,png,gif,webp',
                'mimes:jpg,jpeg,png,gif,webp',
                'mimetypes:image/jpeg,image/png,image/gif,image/webp',
                'max:' . self::MAX_IMAGE_KB,
            ],

            // MediaRecorder hands back a WebM or MP4 container depending on the browser, and
            // an audio-only WebM still sniffs as `video/webm` — the container carries no hint
            // that no video track is inside it. Rejecting that would reject Chrome's own
            // recordings, so the container is allowed and the extension list keeps it honest.
            'audio' => [
                'nullable',
                'file',
                'extensions:webm,mp4,m4a,ogg,oga,mp3,wav',
                'mimetypes:audio/webm,video/webm,audio/mp4,video/mp4,audio/ogg,audio/mpeg,audio/wav,audio/x-wav',
                'max:' . self::MAX_AUDIO_KB,
            ],
        ];
    }

    /**
     * `exists:comments,id` only proves the parent is a comment somewhere — not that it is a
     * comment on *this* post, and not that replying to it is legal. Both need the persisted
     * row, so they run here rather than as rules.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $parentId = $this->input('parent_id');

            if (! $parentId || $validator->errors()->has('parent_id')) {
                return;
            }

            $parent = Comment::find($parentId);

            if ($parent->post_id !== $this->route('post')->id) {
                $validator->errors()->add('parent_id', 'That comment belongs to a different post.');

                return;
            }

            // The thread is one level deep, as in the design. Replying to a reply attaches to
            // its top-level parent instead of nesting further — so a reply cannot be a parent.
            if ($parent->parent_id !== null) {
                $validator->errors()->add('parent_id', 'You cannot reply to a reply.');
            }
        });
    }
}
