"""End-to-end release gate for Hero Lab's highest-traffic journeys.

CI: python -m unittest discover -s tests -p 'test_browser_flows.py' -v
Local restricted runner: HERO_LAB_TEST_INLINE=1 HERO_LAB_BROWSER_PATH=/usr/bin/chromium ...
The inline mode is for diagnostics only; CI serves the real app over HTTP and
executes the persistent-storage tests against a real web origin.
"""
import functools
import http.server
import os
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
INLINE = os.environ.get('HERO_LAB_TEST_INLINE') == '1'
DEVICES = {
    'desktop': dict(viewport={'width': 1440, 'height': 900}, is_mobile=False, has_touch=False),
    'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True),
}


class QuietHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class ThreadingServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


class BrowserJourneys(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingServer(
            ('127.0.0.1', 0),
            functools.partial(QuietHTTPHandler, directory=str(SITE)),
        )
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f'http://127.0.0.1:{cls.server.server_address[1]}/index.html'
        cls.playwright = sync_playwright().start()
        launch_kwargs = {'headless': True, 'args': ['--no-sandbox']}
        if os.environ.get('HERO_LAB_BROWSER_PATH'):
            launch_kwargs['executable_path'] = os.environ['HERO_LAB_BROWSER_PATH']
        cls.browser = cls.playwright.chromium.launch(**launch_kwargs)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def open_page(self, device, context=None):
        if context is None:
            context = self.browser.new_context(**DEVICES[device], reduced_motion='reduce')
            self.addCleanup(context.close)
        page = context.new_page()
        page.set_default_timeout(6000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        self.addCleanup(lambda: self.assertFalse(errors, f'{device} JavaScript errors: {errors}'))
        if INLINE:
            page.set_content((SITE / 'index.html').read_text(encoding='utf-8'), wait_until='domcontentloaded')
        else:
            page.goto(self.base_url, wait_until='domcontentloaded')
        self.assertTrue(page.locator('#launch-view.active').is_visible())
        return page

    def open_hero(self, page, name='Mizuki', role='Support'):
        page.locator(f'[data-launch-role="{role}"]').click()
        self.assertTrue(page.locator('#launch-hero-step').is_visible())
        page.locator('#launch-hero-search').fill(name)
        page.locator(f'[data-launch-hero="{name}"]').click()
        self.assertTrue(page.locator('#hero-detail-view.active').is_visible())
        self.assertIn(name, page.locator('#hero-detail .hero-calm-name').inner_text())

    def test_role_picker_and_hero_search(self):
        """First-time flow must stay interactive on both form factors."""
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.assertTrue(page.locator('#launch-role-step').is_visible())
                page.locator('[data-launch-role="Support"]').click()
                self.assertGreater(page.locator('[data-launch-hero]').count(), 3)
                page.locator('#launch-hero-search').fill('no-such-character-123')
                self.assertEqual(page.locator('[data-launch-hero]').count(), 0)
                self.assertIn('No heroes match', page.locator('#launch-hero-list').inner_text())
                page.locator('#launch-hero-search').fill('Mizuki')
                self.assertEqual(page.locator('[data-launch-hero]').count(), 1)
                page.locator('[data-launch-hero="Mizuki"]').click()
                self.assertTrue(page.locator('#goal-picker').is_visible())
                self.assertEqual(page.locator('#goal-picker [data-help-group]').count(), 5)

    def test_role_switching_and_goals(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                page.locator('[data-launch-role="Tank"]').click()
                self.assertIn('Tank', page.locator('#launch-role-heading').inner_text())
                page.locator('#launch-back-role').click()
                self.assertTrue(page.locator('#launch-role-step').is_visible())
                self.open_hero(page, 'Mizuki', 'Support')
                page.locator('[data-help-group="fight"]').click()
                self.assertTrue(page.locator('[data-help-topic="aim"]').is_visible())
                page.locator('[data-help-topic="aim"]').click()
                self.assertTrue(page.locator('#hero-help-answer').is_visible())
                self.assertGreater(len(page.locator('#hero-help-answer').inner_text()), 80)
                page.locator('#change-goal').click()
                self.assertTrue(page.locator('#goal-picker').is_visible())

    def test_matchup_search_and_selected_guidance(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.locator('[data-help-group="matchups"]').click()
                self.assertTrue(page.locator('#matchup-hero-search').is_visible())
                page.locator('#matchup-hero-search').fill('Tracer')
                self.assertGreater(page.locator('[data-matchup-result]').count(), 0)
                page.locator('[data-matchup-result="Tracer"]').click()
                self.assertIn('Tracer', page.locator('#matchup-selected').inner_text())
                self.assertGreater(len(page.locator('#matchup-selected').inner_text()), 80)
                self.assertTrue(page.locator('#power-share-matchup').is_visible())

    def test_universal_search_and_keyboard_shortcut(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.keyboard.press('Control+k')
                self.assertTrue(page.locator('#tools-view.active').is_visible())
                page.locator('#power-search').fill('Genji')
                self.assertIn('Genji', page.locator('#power-results').inner_text())
                page.locator('#power-results [data-power-action="hero"]').first.click()
                self.assertTrue(page.locator('#hero-detail-view.active').is_visible())
                self.assertIn('Genji', page.locator('#hero-detail .hero-calm-name').inner_text())

    def test_calculator_and_sequence_controls(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.locator('#power-open').click()
                page.locator('[data-power-mode="calc"]').click()
                self.assertTrue(page.locator('#calculator-view.active').is_visible())
                self.assertGreater(page.locator('#calc-pattern .hit-row').count(), 0)
                page.locator('#calc-hero').select_option(label='Mizuki')
                page.locator('#calc-target').select_option(label='Tracer')
                page.locator('#calc-range').fill('20')
                page.locator('#calc-add-hit').click()
                self.assertGreaterEqual(page.locator('#calc-pattern .hit-row').count(), 2)
                page.locator('#calc-pattern [data-sequence-move="up"]:not([disabled])').first.click()
                page.locator('#calc-run').click()
                self.assertIn('Mizuki', page.locator('#calc-result').inner_text())
                self.assertIn('TOTAL DAMAGE', page.locator('#calc-result').inner_text())
                page.locator('#calc-reset').click()
                self.assertGreater(page.locator('.hit-row').count(), 0)

    def test_comparison_interactions_and_history(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.locator('#power-open').click()
                page.locator('[data-power-mode="compare"]').click()
                page.locator('#power-comp-a').select_option(label='Mizuki (Support)')
                page.locator('#power-comp-b').select_option(label='Juno (Support)')
                self.assertIn('Mizuki', page.locator('#power-results table').inner_text())
                self.assertIn('Juno', page.locator('#power-results table').inner_text())
                page.locator('[data-power-mode="interaction"]').click()
                self.assertTrue(page.locator('#power-int-counter').is_visible())
                self.assertIn('QUICK ANSWER', page.locator('#power-results').inner_text())
                page.locator('[data-power-mode="patch"]').click()
                self.assertTrue(page.locator('#power-patch-a').is_visible())
                self.assertIn('recorded changes', page.locator('#power-results').inner_text())

    def test_home_returns_to_today(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                home = page.locator('.nav-btn[data-view="launch"]')
                self.assertIn('Home', home.inner_text())
                home.click()
                self.assertTrue(page.locator('#launch-today-step').is_visible())
                self.assertIn('Mizuki', page.locator('#today-home').inner_text())
                page.locator('#today-continue').click()
                self.assertTrue(page.locator('#hero-detail-view.active').is_visible())
                self.assertIn('Mizuki', page.locator('#hero-detail').inner_text())

    @unittest.skipIf(INLINE, 'Storage requires an HTTP origin, verified in CI')
    def test_practice_progress_persists_after_reload(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.locator('[data-help-group="practice"]').click()
                boxes = page.locator('[data-practice-task]')
                self.assertGreater(boxes.count(), 0)
                first = boxes.first
                first.check()
                self.assertTrue(first.is_checked())
                self.assertIn('1/', page.locator('#practice-progress-label').inner_text())
                self.assertTrue(page.evaluate('Boolean(localStorage.getItem("ow-today-profile-v1"))'))
                page.reload(wait_until='domcontentloaded')
                self.assertTrue(page.locator('#launch-today-step').is_visible())
                page.locator('#today-continue').click()
                page.locator('[data-help-group="practice"]').click() if page.locator('[data-help-group="practice"]').is_visible() else None
                page.locator('[data-practice-task]').first.wait_for(state='attached')
                self.assertTrue(page.locator('[data-practice-task]').first.is_checked())
                self.assertIn('1/', page.locator('#practice-progress-label').inner_text())

    @unittest.skipIf(INLINE, 'Storage requires an HTTP origin, verified in CI')
    def test_follow_preferences_persist_after_reload(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                page.locator('#hero-follow-trigger').click()
                self.assertFalse(page.locator('#live-follow-dialog').is_hidden())
                page.locator('#live-follow-list label').filter(has_text='Mizuki').first.locator('input').check()
                self.assertIn('Mizuki', page.evaluate('JSON.parse(localStorage.getItem("heroLabFollowedHeroes"))'))
                page.reload(wait_until='domcontentloaded')
                self.assertTrue(page.locator('#launch-today-step').is_visible())
                page.locator('#today-continue').click()
                page.locator('#hero-follow-trigger').click()
                self.assertTrue(page.locator('#live-follow-list label').filter(has_text='Mizuki').first.locator('input').is_checked())

    def test_mobile_and_desktop_document_width(self):
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                self.assertTrue(page.locator('#power-open').is_visible())
                self.assertTrue(page.locator('.nav-btn[data-view="launch"]').is_visible())
                metrics = page.evaluate('({doc: document.documentElement.scrollWidth, viewport: window.innerWidth})')
                self.assertLessEqual(metrics['doc'], metrics['viewport'] + 2, f'{device}: horizontal overflow {metrics}')

    def test_hero_patch_provenance_and_review_board(self):
        """Patch status must distinguish source polls from verified stat updates."""
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                card = page.locator('#trust-hero-card')
                card.wait_for(state='visible')
                self.assertIn('Patch accuracy', card.inner_text())
                self.assertIn('Last Blizzard check', card.inner_text())
                self.assertIn('Last verified stats update', card.inner_text())
                self.assertIn('Awaiting review', card.inner_text())
                page.locator('.nav-btn[data-view="patches"]').click()
                board = page.locator('#trust-board')
                board.wait_for(state='visible')
                self.assertIn('Patch accuracy by hero', board.inner_text())
                page.locator('#trust-search').fill('Mizuki')
                self.assertEqual(page.locator('#trust-hero-list .trust-hero-row').count(), 1)
                self.assertIn('Mizuki', page.locator('#trust-hero-list').inner_text())

    def test_quick_switch_current_role_and_cross_role(self):
        """Switch hero without restarting role onboarding, on desktop and mobile."""
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page, 'Mizuki', 'Support')
                self.assertTrue(page.locator('#hero-switch-top').is_visible())
                page.locator('#back-to-heroes').click()
                self.assertTrue(page.locator('#hero-switch-dialog').is_visible())
                self.assertEqual(page.locator('.hero-switch-role.is-active').inner_text(), 'Support')
                self.assertTrue(page.locator('#hero-switch-search').evaluate('(el) => document.activeElement === el'))
                page.locator('#hero-switch-search').fill('Juno')
                page.locator('button[data-hero-name="Juno"]').click()
                self.assertTrue(page.locator('#hero-switch-dialog').is_hidden())
                self.assertEqual(page.locator('#hero-detail .hero-calm-name h2').inner_text(), 'Juno')
                self.assertTrue(page.locator('#goal-picker').is_visible())
                page.locator('#hero-switch-top').click()
                page.locator('button.hero-switch-role[data-role="Damage"]').click()
                page.locator('#hero-switch-search').fill('Genji')
                page.locator('button[data-hero-name="Genji"]').click()
                self.assertEqual(page.locator('#hero-detail .hero-calm-name h2').inner_text(), 'Genji')
                page.locator('#back-to-heroes').click()
                page.keyboard.press('Escape')
                self.assertTrue(page.locator('#hero-switch-dialog').is_hidden())
                self.assertEqual(page.locator('#hero-detail .hero-calm-name h2').inner_text(), 'Genji')

    def test_quick_switch_search_empty_close_and_saved_progress(self):
        """Switching heroes does not discard the previously saved hero's practice."""
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page, 'Mizuki', 'Support')
                page.locator('[data-help-group="practice"]').click()
                self.assertGreater(page.locator('[data-practice-task]').count(), 0)
                page.locator('[data-practice-task]').first.check()
                page.locator('#back-to-heroes').click()
                page.locator('#hero-switch-search').fill('not-a-real-hero')
                self.assertIn('No heroes match', page.locator('#hero-switch-results').inner_text())
                page.locator('#hero-switch-close').click()
                self.assertTrue(page.locator('#hero-switch-dialog').is_hidden())
                page.locator('#hero-switch-top').click()
                page.locator('#hero-switch-search').fill('Juno')
                page.locator('button[data-hero-name="Juno"]').click()
                page.locator('#back-to-heroes').click()
                page.locator('#hero-switch-search').fill('Mizuki')
                page.locator('button[data-hero-name="Mizuki"]').click()
                page.locator('[data-help-group="practice"]').click()
                self.assertTrue(page.locator('[data-practice-task]').first.is_checked())

    def test_compact_middle_sidebar_and_reachable_navigation(self):
        """Desktop navigation is compact and centered; mobile navigation stays at bottom."""
        for device in DEVICES:
            with self.subTest(device=device):
                page = self.open_page(device)
                self.open_hero(page)
                bounds = page.evaluate("""() => {
                  const s = document.querySelector('.sidebar').getBoundingClientRect();
                  const m = document.querySelector('.main').getBoundingClientRect();
                  return {top: s.top, bottom: s.bottom, left: s.left, width: s.width,
                          height: s.height, mid: s.top + s.height / 2,
                          mainLeft: m.left, viewportHeight: innerHeight,
                          docWidth: document.documentElement.scrollWidth,
                          viewportWidth: innerWidth, position: getComputedStyle(document.querySelector('.sidebar')).position};
                }""")
                self.assertEqual(bounds['position'], 'fixed')
                self.assertLessEqual(bounds['docWidth'], bounds['viewportWidth'] + 2)
                if device == 'desktop':
                    self.assertLess(bounds['height'], bounds['viewportHeight'] * 0.65)
                    self.assertLess(abs(bounds['mid'] - bounds['viewportHeight'] / 2), 8)
                    self.assertGreater(bounds['mainLeft'], bounds['left'] + bounds['width'] + 5)
                else:
                    self.assertGreater(bounds['bottom'], bounds['viewportHeight'] - 24)
                page.locator('.nav-btn[data-view="patches"]').click()
                self.assertTrue(page.locator('#patches-view.active').is_visible())
                page.locator('.nav-btn[data-view="compare"]').click()
                self.assertTrue(page.locator('#compare-view.active').is_visible())
                page.locator('.nav-btn[data-view="launch"]').click()
                self.assertTrue(page.locator('#launch-view.active').is_visible())

        tablet = self.browser.new_context(viewport={'width': 820, 'height': 900}, reduced_motion='reduce')
        self.addCleanup(tablet.close)
        page = self.open_page('desktop', context=tablet)
        self.open_hero(page)
        metrics = page.evaluate("""() => {
            const s=document.querySelector('.sidebar').getBoundingClientRect();
            const m=document.querySelector('.main').getBoundingClientRect();
            return {mid:s.top+s.height/2,height:s.height,width:s.width,
                    mainLeft:m.left,edge:s.right,
                    doc:document.documentElement.scrollWidth,viewport:innerWidth};
        }""")
        self.assertLess(abs(metrics['mid'] - 450), 8)
        self.assertLess(metrics['height'], 420)
        self.assertLess(metrics['width'], 85)
        self.assertGreater(metrics['mainLeft'], metrics['edge'] + 10)
        self.assertLessEqual(metrics['doc'], metrics['viewport'] + 2)
        page.locator('.nav-btn[data-view="patches"]').click()
        self.assertTrue(page.locator('#patches-view.active').is_visible())


if __name__ == '__main__':
    unittest.main(verbosity=2)