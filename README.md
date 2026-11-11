# Hero Lab | Live Patch Engine

This project packages the existing Hero Lab static HTML together with a **server-side polling + validation + build + GitHub Pages deployment pipeline**. The base Hero Lab app and Power-user Tools are retained.

## Delivered capabilities

1. **Official polling:** GitHub Actions checks Blizzard's official Live patch notes twice per hour (subject to GitHub scheduler delays and Blizzard availability). Uses a 35-second request timeout.
2. **Patch parser:** Extracts dated hero-change bullets while retaining the original wording, hero, ability, and mode.
3. **Change validation:** Approves only exact standard-mode base hero health/armor/shields changes when the recorded old value matches the verified baseline. All other changes are held as `parsed_pending_validation` or `needs_review` and **not automatically applied**.
4. **Derived stats:** Rebuilds the embedded database, updates safe hero stat rows and total HP where all components are numeric. Existing damage, breakpoint and TTK tools use the rebuilt database. Changes to complex ability/weapon stats require human verification and a database update; the pipeline **does not automatically recalculate unknown mechanics**.
5. **Automatic rebuild:** `scripts/patch_engine.py` injects the audited snapshot back into `site/index.html`, maintaining the original UI.
6. **Production deployment:** GitHub Actions runs tests, rebuilds and publishes to GitHub Pages. Active on the published GitHub Pages site; scheduled runs are subject to GitHub delays.
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

The official source is `https://overwatch.blizzard.com/en-us/news/patch-notes/`. It can change HTML structure; if parsing fails, scheduled deployment stops and previous published output remains in place. Every parsed text entry is retained with an explicit status. Unknown/new heroes, perk changes, Stadium-specific rules, mixed modes, and uncertain percentage changes remain pending. Human-reviewed changes should be incorporated into the canonical database and verified against live gameplay rules before modifying derived damage formulas.

**Operational gaps:** A reliable production-grade service also needs metrics/alerts for repeated CI failures, a database/approval UI for complex mechanics, optional authentication and user subscriptions, a Web Push service worker and push backend, and a deployment rollback process. This package is a safe foundation rather than a claim those systems already exist.

## Patch accuracy and pipeline alerts

- Every hero now has a provenance card below their name: last *successful* official Blizzard page check, last verified stat record and its source (seeded reference versus approved official change), and count of unapplied notes awaiting review.
- The Patch History view also has a searchable 53-hero status board, including an "awaiting review" filter.
- Successful polls are **not** the same as independent verification of a hero's complete kit. The browser marks polls more than two hours old as overdue, rather than leaving a perpetual "current" indicator.
- Unknown heroes and Stadium/6v6 notes are not silently mapped onto standard-mode hero stats. Repeat polls do not rewrite prior verification timestamps.
- GitHub Actions has a final pipeline-health job. A failed build or deployment creates one assigned GitHub issue, updates that issue on subsequent failed runs, and closes it after full recovery. Turn on **GitHub issue assignment notifications** for the repository to receive these alerts by email or mobile. The old site stays live if the release gate fails.
- The app does not yet include manual approval tooling for complex changes; those remain explicitly pending until reviewed and updated in the canonical source.

## Switching heroes without restarting onboarding

From any hero detail page, use the clear **Change hero** button or the sticky header shortcut. The searchable hero picker defaults to the current role (Support, Damage, or Tank), with one-tap role tabs and an All filter. Selecting a different hero opens that hero's improvement goals directly. Practice completion and favorites are stored per hero and are not cleared; pressing Escape, Cancel, or the backdrop keeps the current hero. The quick-switch JavaScript and CSS are maintained as separate relative assets and re-linked on each automated patch rebuild.

## Compact centered desktop navigation

The old full-height sidebar is now a short, fixed navigation card centered on the left edge of the desktop viewport. Its buttons remain at least 44px tall, and the page continues to scroll independently. Intermediate tablet widths use a centered icon rail; screens up to 680px retain the existing bottom navigation. The old static sidebar patch notice is hidden in favor of the up-to-date per-hero patch accuracy information. Automated desktop, tablet, and mobile checks verify center alignment, clickable navigation and no horizontal overlap.

## Floating top navigation

The post-onboarding header now sits below the top edge in a centered, max-width floating card, with its controls grouped close to the hero title. It stays sticky while scrolling so Search, Follow heroes and Change hero remain reachable. On desktop the bar starts roughly 9vh lower than the top boundary; tablet uses a compact wrapping bar and mobile retains its bottom navigation while receiving a smaller two-row header below the phone's safe area. The CSS is kept in site/compact-topbar.css and reinjected automatically during patch builds. The browser release gate checks the header's position, control bounds, sticky behavior, and hero-switch/follow actions at desktop, mobile, and tablet widths.
