<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('title')->nullable()->after('type');
            $table->unsignedBigInteger('likes_count')->default(0);
            $table->unsignedBigInteger('comments_count')->default(0);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedBigInteger('likes_count')->default(0);
            $table->unsignedBigInteger('replies_count')->default(0);
        });

        Schema::create('post_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('location')->nullable();
            $table->timestamps();

            $table->unique('post_id');
            $table->index('starts_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_events');

        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn(['likes_count', 'replies_count']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['title', 'likes_count', 'comments_count']);
        });
    }
};
