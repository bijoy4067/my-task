<?php

namespace App\Http\Requests;

use App\Models\Post;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    public const MAX_IMAGES = 10;

    /** 5 MB per image. */
    public const MAX_IMAGE_KB = 5120;

    /** 50 MB per video. Anything larger needs a chunked or direct-to-storage upload. */
    public const MAX_VIDEO_KB = 51200;

    public function rules(): array
    {
        $type = $this->input('type');

        return [
            'type' => ['required', Rule::in(Post::TYPES)],
            'visibility' => ['required', Rule::in(Post::VISIBILITIES)],

            'body' => [Rule::requiredIf(in_array($type, ['status', 'article'], true)), 'nullable', 'string', 'max:5000'],
            'title' => [Rule::requiredIf(in_array($type, ['event', 'article'], true)), 'nullable', 'string', 'max:255'],

            // Three layers on every upload, because each catches something the others miss:
            // `extensions` checks the client filename, `mimes` checks the guessed extension
            // against the sniffed content, and `mimetypes` pins the real MIME type. A .php
            // renamed to .jpg fails; a real GIF renamed to .mp4 fails too.
            // Any post type may carry media — an event or article can have a cover image.
            'images' => [Rule::requiredIf($type === 'photo'), 'nullable', 'array', 'max:'.self::MAX_IMAGES],
            'images.*' => [
                'image',
                'extensions:jpg,jpeg,png,gif,webp',
                'mimes:jpg,jpeg,png,gif,webp',
                'mimetypes:image/jpeg,image/png,image/gif,image/webp',
                'max:'.self::MAX_IMAGE_KB,
            ],
            'video' => [
                Rule::requiredIf($type === 'video'),
                'nullable',
                'file',
                'extensions:mp4,webm,mov',
                'mimes:mp4,webm,mov',
                'mimetypes:video/mp4,video/webm,video/quicktime',
                'max:'.self::MAX_VIDEO_KB,
            ],

            'starts_at' => [Rule::requiredIf($type === 'event'), 'nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'location' => ['nullable', 'string', 'max:255'],
        ];
    }
}
