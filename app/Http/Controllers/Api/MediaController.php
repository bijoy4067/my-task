<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use Illuminate\Support\Facades\Gate;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MediaController extends Controller
{
    /**
     * Media lives on a private disk, so every file is streamed through the owning model's
     * policy. Without this, a private post's image would be readable by URL alone.
     */
    public function show(Media $media): BinaryFileResponse
    {
        $model = $media->model;

        if ($model instanceof Post) {
            Gate::authorize('view', $model);
        }

        // A comment's attachments are only as visible as the post they hang off — otherwise a
        // private post's thread would leak its images and voice notes by URL.
        if ($model instanceof Comment) {
            Gate::authorize('view', $model->post);
        }

        return response()->file($media->getPath(), [
            'Content-Type' => $media->mime_type,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
