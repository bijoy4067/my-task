<?php

namespace App\Http\Requests;

use App\Models\Post;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePostRequest extends FormRequest
{
    public function rules(): array
    {
        // A post's type is fixed at creation — editing only ever touches its content,
        // so the required-ness of each field is read from the existing type, not from input.
        $type = $this->route('post')->type;

        return [
            'visibility' => ['required', Rule::in(Post::VISIBILITIES)],

            'body' => [Rule::requiredIf(in_array($type, ['status', 'article'], true)), 'nullable', 'string', 'max:5000'],
            'title' => [Rule::requiredIf(in_array($type, ['event', 'article'], true)), 'nullable', 'string', 'max:255'],

            // New images are appended to what the post already has; `remove_images` names
            // the existing ones (by media id) to drop. See withValidator() for the combined cap.
            'images' => ['nullable', 'array', 'max:'.StorePostRequest::MAX_IMAGES],
            'images.*' => [
                'image',
                'extensions:jpg,jpeg,png,gif,webp',
                'mimes:jpg,jpeg,png,gif,webp',
                'mimetypes:image/jpeg,image/png,image/gif,image/webp',
                'max:'.StorePostRequest::MAX_IMAGE_KB,
            ],
            'remove_images' => ['nullable', 'array'],
            'remove_images.*' => ['integer'],

            // A new video file replaces the existing one; `remove_video` drops it with nothing
            // to replace it.
            'video' => [
                'nullable',
                'file',
                'extensions:mp4,webm,mov',
                'mimes:mp4,webm,mov',
                'mimetypes:video/mp4,video/webm,video/quicktime',
                'max:'.StorePostRequest::MAX_VIDEO_KB,
            ],
            'remove_video' => ['nullable', 'boolean'],

            'starts_at' => [Rule::requiredIf($type === 'event'), 'nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'location' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        // These checks weigh the edit against the post's *current* media, which only the
        // model (not a plain array rule) knows — so they run after the shape-level rules pass.
        $validator->after(function (Validator $validator) {
            $post = $this->route('post');

            $remainingImages = $post->getMedia('images')->count()
                - count($this->input('remove_images', []))
                + count($this->file('images', []));

            if ($remainingImages > StorePostRequest::MAX_IMAGES) {
                $validator->errors()->add('images', 'A post can have at most '.StorePostRequest::MAX_IMAGES.' images.');
            }

            if ($post->type === 'photo' && $remainingImages <= 0) {
                $validator->errors()->add('images', 'A photo post needs at least one image.');
            }

            if ($post->type === 'video') {
                $keepsExistingVideo = ! $this->boolean('remove_video') && $post->getFirstMedia('videos');

                if (! $keepsExistingVideo && ! $this->hasFile('video')) {
                    $validator->errors()->add('video', 'A video post needs a video.');
                }
            }
        });
    }
}
