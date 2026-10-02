# Change 15 (hotfix): Bad push keys kept the new version from going live

**Date:** 2026-10-02 (after launch)

## What happened

After changes 10–14 were merged, the live site kept serving the **old** version:
- `/api/notifications` returned 404.
- The page had no link-preview tag, and `/og-image.png` came back as the HTML fallback page.
- The live JavaScript bundle didn't match a fresh build of `main`.

Yet ML Lifestyle Park (change 10) was in the production database, so the newer deploys were getting through **build and seed** and then failing at **start**. Render keeps the previous version running when a new one fails its health check.

The AI couldn't see Render's logs, so it tested the most likely cause locally, the step just taken: adding the VAPID keys in Render's dashboard. Both a **quoted key** and **swapped keys** made `web-push` throw while the server was loading ("Vapid public key must be a URL safe Base 64…" / "…should be 65 bytes long"). That crashed the process before it could listen.

## The fix

- Keys are cleaned when they're read. Surrounding spaces and quotes, typical when pasting into a dashboard, are stripped.
- **Invalid keys no longer stop the server.** `configurePush()` catches the error, logs a clear line ("Push is OFF: the VAPID keys are invalid … Check VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."), and the server starts with push off. The in-app inbox still works.
- A test covers swapped, garbage, missing, and valid keys.

Checked by starting the production build locally with quoted keys (it started, push on) and with swapped keys (it started, push off, error logged).

**Lesson:** an optional feature's config must never be able to take the whole site down.
