# Browser and sharing branding

`frontend/src/app/layout.tsx` owns the Next.js metadata. The default title is
`Spatial Network`; route metadata supplies short titles through the
`%s | Spatial Network` template. Open Graph and Twitter cards share the overall
application branding.

The demo uses `https://hussainhht.github.io/Spacial-Network/` and describes the
showcase as fictional local data with no live backend. `NEXT_PUBLIC_BASE_PATH`
can override the demo path, including an empty string for a root deployment.
Image URLs are constructed once from the deployment URL. App Router serves the
icon files; explicit SVG/Apple metadata links include the configured base path.
Next.js 16.3.2 omits inferred SVG/Apple links when an `icons` metadata object is
also supplied, so both are listed explicitly alongside the favicon shortcut.

Full-stack builds use root-relative icon links and default metadata URLs to
`http://localhost:3000/`. Set the server environment variable `SITE_URL` to the
public frontend URL when hosting the full-stack application elsewhere. Include
the scheme and port when needed. This setting only affects metadata; backend
configuration and demo behavior are unchanged.

## Assets

- `frontend/src/app/icon.svg`: editable orbital mark adapted from the existing
  `AppIcon` orbit motif, using the theme's navy, Earth blue and Sun amber.
- `frontend/src/app/favicon.ico`: the mark rendered at 16, 32 and 48 pixels.
- `frontend/src/app/apple-icon.png`: 180×180 version of the same mark.
- `frontend/public/branding/spatial-network-og.jpg`: optimized 1200×630 JPEG,
  approximately 71 KB, used by Open Graph and Twitter.

The social preview was generated with the built-in imagegen tool and resized
and JPEG-optimized with the existing Sharp installation. Generation prompt:

> Use case: ads-marketing. Create a finished premium Open Graph social sharing
> image for Spatial Network, a space-themed social platform. Landscape 1200x630
> composition (aspect ratio 1.905:1). Dark cinematic navy background #050816 with
> restrained stars, subtle cool blue #69aef0 and warm amber #e5a13c accents. A
> beautifully lit realistic blue planet on the right, mostly shadow with
> atmospheric rim light, crossed by a fine elegant elliptical orbital ring.
> Keep all important elements well within the frame. Left half contains very
> clear large refined sans-serif typography, white, reading exactly "Spatial
> Network" on two lines, with "Spatial" above "Network". Below it a smaller but
> readable line exactly "Connect Beyond Boundaries" in muted pale blue. Title
> and tagline have strong contrast and are readable as a small thumbnail.
> Generous negative space, confident clean composition, sophisticated and
> minimal. Existing identity is orbital symbols, planetary imagery and dark
> navy with blue and amber accents. No badges, no technical descriptions, no
> other text, no logos from other brands, no watermark. Opaque background.

## Verification

From `frontend/`:

```sh
npm run typecheck
npm run lint
npm run build -- --webpack
npm run build:demo
node scripts/verify-branding-export.mjs
```

The last command checks the generated static artifact: route titles, demo
description, application name, Open Graph and Twitter fields, icon URLs and
files, ICO resolutions, and JPEG presence and size. It honors
`NEXT_PUBLIC_BASE_PATH` for alternate demo deployments. No social platform cache
refresh is implied by these local checks.
