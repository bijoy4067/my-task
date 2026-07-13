<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="UTF-8">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <link rel="icon" href="/assets/images/logo-copy.svg">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>{{ config('app.name', 'Buddy Script') }}</title>

        <!--Fonts-->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;300;400;500;600;700;800&display=swap" rel="stylesheet">

        <!--Bootstrap-->
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css">
        <!--Common Css-->
        <link rel="stylesheet" href="/assets/css/common.css">
        <!--Custom Css-->
        <link rel="stylesheet" href="/assets/css/main.css">
        <!--Responsive Css-->
        <link rel="stylesheet" href="/assets/css/responsive.css">

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    </head>
    <body>
        <div id="app"></div>

        <script src="/assets/js/bootstrap.bundle.min.js" defer></script>
        {{-- custom.js is the static template's script: it grabs DOM nodes on load, before React
             has rendered any, and throws on the first null — taking the theme toggle and every
             dropdown down with it. React owns that behaviour now (see useTheme / Header). --}}
    </body>
</html>
