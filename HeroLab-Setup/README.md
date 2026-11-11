# Hero Lab | Live Patch Engine

This project packages the existing Hero Lab static HTML together with a **server-side polling + validation + build + GitHub Pages deployment pipeline**. The base Hero Lab app and Power-user Tools are retained.

## Delivered capabilities

1. **Official polling:** GitHub Actions checks Blizzard's official Live patch notes twice per hour (subject to GitHub scheduler delays and Blizzard availability). Uses a 35-second request timeout.
2. **Patch parser:** Extracts dated hero-change bullets while retaining the original wording, hero, ability, and mode.
3. **Change validation:** Approves only exact standard-mode base hero health/armor/shields changes when the recorded old value matches the verified baseline. All other changes are held as `parsed_pending_validation` or `needs_review` and **not automatically applied**.
4. **Derived stats:** Rebuilds the embedded database, updates safe hero stat rows and total HP where all components are numeric. Existing damage, breakpoint and TTK tools use the rebuilt database. Changes to complex ability/weapon stats require human verification and a database update; the pipeline **does not automatically recalculate unknown mechanics**.
5. **Automatic rebuild:** `scripts/patch_engine.py` injects the audited snapshot back into `site/index.html`, maintaining the original UI.
6. **Production deployment:** GitHub Actions runs tests, rebuilds and publishes to GitHub Pages. **Not active until repository is configured.**
7. **Hero follows:** Users choose followed heroes in the application. Follow preferences stay in local storage, and new notes appear on the next visit/refresh. Browser notifications can appear when opening the app with permission on HTTPS. True background push and cross-device follows are **not included**. Optionally configure a channel-wide Discord webhook for new notes.

## Enable deployment

1. Create a GitHub repository; upload the **contents of this archive** to its default `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. In **Settings → Actions → General**, grant workflows read/write permissions for `GITHUB_TOKEN` when necessary. Restrict who may edit workflows. The workflow writes `state/` and `site/index.html` on successful polls.
4. Open **Actions → Hero Lab live patch engine → Run workflow** to run the initial poll. Subsequent polling is scheduled at minute 7 and 37 of each hour, but schedule timing is best effort.
5. Optionally set repository secret `PATCH_NOTIFICATION_WEBHOOK` to a Discord webhook URL for channel-wide announcements. Do not put secrets in HTML or commit subscriber contact data.
6. Test the published site, including Hero Follow preferences. The in-app status will show the last successful poll, not an invented "checked just now" time.

## Local checks

```sh
pip install -r requirements.txt
python -m unittest discover -s tests -v
node scripts/check_html.cjs
python scripts/patch_engine.py --fixture tests/official_fixture.html --dry-run
```

`python scripts/patch_engine.py` makes a real request to the Blizzard website and fails if the site becomes unavailable or changes its markup. It does **not** mark the snapshot refreshed on failures. Static local HTML is not a live-polling service.

## Review and safety

The official source is `https://overwatch.blizzard.com/en-us/news/patch-notes/pc%20/`. It can change HTML structure; if parsing fails, scheduled deployment stops and previous published output remains in place. Every parsed text entry is retained with an explicit status. Unknown/new heroes, perk changes, Stadium-specific rules, mixed modes, and uncertain percentage changes remain pending. Human-reviewed changes should be incorporated into the canonical database and verified against live gameplay rules before modifying derived damage formulas.

**Operational gaps:** A reliable production-grade service also needs metrics/alerts for repeated CI failures, a database/approval UI for complex mechanics, optional authentication and user subscriptions, a Web Push service worker and push backend, and a deployment rollback process. This package is a safe foundation rather than a claim those systems already exist.
