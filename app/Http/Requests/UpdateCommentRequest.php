<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCommentRequest extends FormRequest
{
    /**
     * Only the text is editable. A comment cannot be re-parented onto another thread or moved
     * to another post after the fact, so `parent_id` and `post_id` are deliberately absent.
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:' . StoreCommentRequest::MAX_BODY],
        ];
    }
}
