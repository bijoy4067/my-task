<?php

namespace App\Http\Requests;

use App\Models\Comment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCommentRequest extends FormRequest
{
    public const MAX_BODY = 2000;

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:' . self::MAX_BODY],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
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
