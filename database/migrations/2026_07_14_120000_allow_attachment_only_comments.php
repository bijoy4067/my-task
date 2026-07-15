<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A comment can now carry images or a voice note, and one that does needs no text at all —
     * a photo or a recording says enough on its own. The body was NOT NULL from when text was
     * the only thing a comment could be.
     *
     * StoreCommentRequest still refuses a comment with no text *and* no attachment, so this
     * does not open the door to empty rows.
     */
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->text('body')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Text-less comments would violate the restored constraint, so they are given a
        // placeholder rather than blocking the rollback.
        DB::table('comments')->whereNull('body')->update(['body' => '']);

        Schema::table('comments', function (Blueprint $table) {
            $table->text('body')->nullable(false)->change();
        });
    }
};
