# Implementation Plan: Spin the Wheel

## Approach
Pure frontend feature. A new `/spin` page fetches all recipes (reusing the existing `recipeService`), renders a CSS-animated spinning wheel, and reveals the randomly selected recipe after the animation. A button is added to the home page to surface the feature.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions

- **CSS rotation, not Canvas**: Using `transform: rotate()` with a CSS transition on a wheel `div` is simpler than Canvas, avoids imperative drawing code, and is fully compatible with Next.js SSR/hydration. The wheel is built from SVG or conic-gradient segments.
- **Conic-gradient wheel**: Use a single `div` with `background: conic-gradient(...)` to paint segments — zero dependencies, pure CSS. Overlay text labels via absolutely-positioned `div`s rotated to center in each segment.
- **No new API**: Reuses `recipeService.getAllRecipes()` with the auth token, exactly like the home page does.
- **Cap at 20 recipes**: More than 20 segments makes text unreadable. Show the first 20 if the API returns more.
- **Spin logic**: Before animating, pick a random target recipe index. Compute the final rotation angle (multiple full rotations + the angle to land the target segment at the top/pointer). Apply via CSS transition. After `transitionend`, show the result card.
- **Route**: New Next.js App Router route at `app/spin/` with `page.tsx` (force-dynamic, server wrapper) + `client.tsx` (all interactivity).

## Risks

- **Text overflow in segments**: Long recipe titles. Mitigation: truncate to ~15 chars with ellipsis in segment labels. Full title shown in result card.
- **Hydration mismatch**: Random angle must be computed client-side only (inside a click handler), not during render. This is already the case since spin is triggered by user interaction.
- **Auth loading race**: Same pattern as home page — wait for `authLoading` to resolve before fetching recipes.
