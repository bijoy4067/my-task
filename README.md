# Buddy Script (my-project1)

A social feed application — posts (status/photo/video/event/article), likes, comments, and media
uploads — built on a Laravel API backend with a React single-page frontend mounted into a single
Blade view.

## Tech stack

| Layer      | Technology                                                                 |
|------------|-----------------------------------------------------------------------------|
| Backend    | PHP 8.3, Laravel 13, Spatie Laravel MediaLibrary (file uploads)             |
| Frontend   | React 19, React Router 7 (client-side routing), Tailwind CSS 4              |
| Build tool | Vite 8 + `laravel-vite-plugin` (asset bundling, HMR)                       |
| Database   | Any Laravel-supported DB (SQLite by default via `.env`)                    |
| Auth       | Laravel session auth (`Auth` facade + `auth` middleware), CSRF-protected   |
| Testing    | PHPUnit (`tests/`)                                                          |

## Architecture overview

This is a **Laravel-hosted SPA**, not a classic multi-page Blade app and not a decoupled API +
separately-deployed frontend:

```
Browser
  │
  ▼
routes/web.php
  ├─ /api/*        → JSON API controllers (session-authenticated)
  └─ /{any}        → resources/views/welcome.blade.php (catch-all)
                        │
                        ▼
                 <div id="app"></div> + @vite(resources/js/app.jsx)
                        │
                        ▼
                 resources/js/app.jsx  (React root, wraps app in <BrowserRouter>)
                        │
                        ▼
                 resources/js/Pages/PageRender.jsx  (React Router route table)
                        │
              ┌─────────┼──────────────┬─────────────┐
              ▼         ▼              ▼             ▼
          /login    /register      / (Feed)     /posts/:id/edit
```

- **One Laravel route serves the whole UI.** `routes/web.php` has a catch-all (`Route::get('/{any}', …)`)
  that always returns `welcome.blade.php`. That view just mounts the React app — it has no
  page-specific Blade templates. All page-to-page navigation happens client-side via React Router.
- **Everything else in `routes/web.php` is a JSON API** under `/api/*`, consumed by the React app via
  `fetch` (see `resources/js/utils/ApiFetcher.js`). Auth is Laravel's own session/cookie auth (not
  token-based), so the SPA and API share the same origin and CSRF cookie.
- **Media (images/videos)** are stored on a private disk and never served by a public URL. They're
  streamed through `GET /api/media/{media}` (`MediaController`), which re-checks the owning post's
  visibility policy on every request.

## Directory guide — where things live

### Backend (`app/`, `routes/`, `database/`)

| Path                                   | What it's for                                                                 |
|-----------------------------------------|--------------------------------------------------------------------------------|
| `routes/web.php`                        | All routes: `/api/*` JSON endpoints + the SPA catch-all route                 |
| `app/Http/Controllers/Api/`             | API controllers — one per resource (see table below)                          |
| `app/Http/Requests/`                    | Form request validation (`StorePostRequest`/`UpdatePostRequest`, `StoreCommentRequest`/`UpdateCommentRequest`) |
| `app/Http/Resources/`                   | `PostResource`, `CommentResource` — shape Eloquent models into the JSON the frontend expects |
| `app/Policies/`                         | `PostPolicy`, `CommentPolicy` — view/update/delete authorization rules         |
| `app/Support/`                          | `Likes`/`PostLikes` — bulk-hydrate `liked_by_me` + reactor previews for a page of posts or comments, avoiding N+1 |
| `app/Models/`                           | Eloquent models: `User`, `Post`, `PostEvent`, `Comment`, `Like`                |
| `app/Models/Concerns/Likeable.php`      | Shared trait giving `Post` and `Comment` their `likes()`/`isLikedBy()` behavior |
| `database/migrations/`                  | Schema: users, posts, comments, likes, media, post events                      |

**API controllers:**

| Controller         | Routes                                                        | Responsibility                                  |
|---------------------|---------------------------------------------------------------|--------------------------------------------------|
| `AuthController`    | `POST /api/register`, `/api/login`, `/api/logout`, `GET /api/user` | Session auth (register/login/logout/whoami)  |
| `FeedController`    | `GET /api/feed`                                                | Keyset-paginated post feed (`?cursor=`)          |
| `PostController`    | `GET/POST/PUT/DELETE /api/posts[/{post}]`                       | CRUD for posts (status/photo/video/event/article) |
| `LikeController`    | `POST/DELETE /api/posts/{post}/like`, `POST/DELETE /api/comments/{comment}/like`, `GET /api/posts/{post}/likes` | Toggle a like on a post or comment (maintains the denormalized counters); list who reacted |
| `CommentController` | `GET/POST /api/posts/{post}/comments`, `PUT/DELETE /api/comments/{comment}` | Comment thread — top-level + one level of replies, each with image/voice-note attachments |
| `MediaController`   | `GET /api/media/{media}`                                       | Streams a post's or comment's private image/video/audio with a policy check |

### Frontend (`resources/js/`)

| Path                                       | What it's for                                                                 |
|----------------------------------------------|--------------------------------------------------------------------------------|
| `app.jsx`                                    | Entry point — mounts React into `#app`, wraps everything in `<BrowserRouter>`  |
| `Pages/PageRender.jsx`                       | Route table (`/login`, `/register`, `/`, `/posts/:id/edit`)                    |
| `Pages/Login/Index.jsx`, `Register/Index.jsx`| Auth forms, use `useAuth()` from the auth service                              |
| `Pages/VerifyAuth.jsx`                       | Route guard — redirects to `/login` if `useAuth()` has no user                 |
| `Pages/Feed/Index.jsx`                       | Main feed page (composer + post list + sidebars)                              |
| `Pages/Feed/Edit.jsx`                        | Edit-post page, reuses `FeedForm` pre-filled with the existing post            |
| `components/FeedForm.jsx`                    | Post composer/editor — status/photo/video/event/article + media attachments   |
| `components/PostList.jsx`, `PostCard.jsx`, `PostBody.jsx`, `PostGallery.jsx`, `PostEvent.jsx` | Feed rendering — list, individual card, body-by-type, image gallery, event details |
| `components/LikersModal.jsx`                  | "Who reacted" modal — paginated list of everyone who liked a post, opened from the reactor avatar row |
| `components/CommentList.jsx`, `CommentItem.jsx`, `CommentBox.jsx` | Comment thread under a post — list + "view previous", one comment (with replies/like/edit/delete), and the composer (text + image + voice-note attachments) |
| `components/Header.jsx`, `LeftSideBar.jsx`, `RightSideBar.jsx`, `MiddleLayout.jsx` | Page chrome/layout shared across the feed |
| `hooks/useFeed.js`                           | Owns feed state: posts array, cursor, `loadMore`/`prependPost`/`updatePost`/`removePost` |
| `hooks/useComments.js`                        | Owns one post's comment thread: list, cursor, `addComment`/`patchComment`/`removeComment` |
| `hooks/useLikeToggle.js`                      | Shared optimistic like toggle (post or comment) — flips locally, reconciles with the server, guards double-clicks |
| `hooks/useAudioRecorder.js`                   | `MediaRecorder` wrapper for recording a comment voice note; degrades gracefully where unsupported |
| `hooks/useDropdown.js`                       | Open/close + outside-click/escape behavior for any dropdown menu              |
| `hooks/useTheme.js`                           | Dark/light mode toggle, persisted to `localStorage`                           |
| `services/AuthServiceProvider.jsx`           | `AuthProvider`/`useAuth()` — current user, login/register/logout               |
| `utils/ApiFetcher.js`                        | `apiFetch()` — fetch wrapper adding CSRF token + JSON/FormData headers        |
| `utils/formatTimeAgo.js`                     | Relative-time formatting ("3 hours ago") for post timestamps                  |

### Static template assets

`welcome.blade.php` also loads Bootstrap CSS/JS and the original static HTML template's CSS
(`/assets/css/*`) for shared visual styling — layout is otherwise plain React + Tailwind. The
template's own `custom.js` is intentionally **not** loaded; its DOM-timing assumptions clash with
React, so `useTheme`/`useDropdown`/`Header` reimplement that behavior in React instead.

## Request/response flow examples

**Loading the feed:**
`Feed/Index.jsx` → `useFeed()` → `apiFetch('/api/feed?cursor=…')` → `FeedController@index`
(keyset-paginated by `id`, `visibleTo($user)` scope on `Post`) → `PostResource::collection()` →
JSON `{ data, meta: { next_cursor } }` → appended into feed state.

**Creating a post:**
`FeedForm.jsx` (multipart `FormData`, since images/video may attach) → `POST /api/posts` →
`StorePostRequest` (per-type validation, 3-layer file checks) → `PostController@store` (DB
transaction: create post → optionally create `PostEvent` → attach media via Spatie MediaLibrary) →
`PostResource` → new post prepended into feed state via `prependPost()`.

**Editing a post:**
`PUT /api/posts/{post}` is spoofed as `POST` with `_method=PUT` in the `FormData` body (real PUT
can't carry `$_FILES`), handled by Laravel's method-override middleware →
`UpdatePostRequest` → `PostController@update` (`Gate::authorize('update', $post)` via `PostPolicy`).

## Local setup

```bash
composer install
cp .env.example .env      # (composer setup script does this automatically)
php artisan key:generate
php artisan migrate

npm install
```

**Run everything (server + queue + logs + Vite) in one command:**

```bash
composer run dev
```

**Or run pieces separately:**

```bash
php artisan serve   # backend, http://localhost:8000
npm run dev          # Vite dev server (HMR)
```

**Build frontend assets for production:**

```bash
npm run build
```

**Run tests:**

```bash
composer test        # clears config cache, then runs php artisan test
```
