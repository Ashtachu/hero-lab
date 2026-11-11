"""Provenance and mode separation must never silently bless unverified stats."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import patch_engine as p

ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'state/baseline.json').read_text())

class TrustTests(unittest.TestCase):
    def test_stadium_role_heading_does_not_reset_mode(self):
        html='''<main><h2>November 5, 2026</h2><h3>Stadium Updates</h3><h4>Tank</h4><h5>Reaper</h5><ul><li>Base health increased from 275 to 300.</li></ul></main>'''
        records=p.parse_official(html,BASE['heroes'])
        self.assertEqual(len(records),1)
        self.assertEqual(records[0]['game_mode'],'stadium')
        self.assertNotEqual(p.validate(records[0],BASE)['status'],'auto_verified')

    def test_6v6_inline_note_not_applied_to_standard_stats(self):
        html='''<main><h2>November 5, 2026</h2><h3>Hero Updates</h3><h4>Damage</h4><h5>Reaper</h5><ul><li>Base health increased from 275 to 300. (6v6)</li></ul></main>'''
        records=p.parse_official(html,BASE['heroes'])
        self.assertEqual(records[0]['game_mode'],'6v6')
        self.assertNotEqual(p.validate(records[0],BASE)['status'],'auto_verified')

    def test_unknown_hero_heading_does_not_attach_to_previous_hero(self):
        html='''<main><h2>November 5, 2026</h2><h3>Hero Updates</h3><h4>Support</h4><h5>Brigitte</h5><ul><li>Armor increased from 75 to 80.</li></ul><h5>Not In App Yet</h5><ul><li>Health increased from 200 to 225.</li></ul></main>'''
        records=p.parse_official(html,BASE['heroes'])
        self.assertEqual(len(records),1)
        self.assertEqual(records[0]['hero'],'Brigitte')

    def test_provenance_labels_distinguish_seeded_stats_from_auto_approved(self):
        html='''<main><h2>November 5, 2026</h2><h3>Hero Updates</h3><h4>Damage</h4><h5>Reaper</h5><ul><li>Base health increased from 275 to 300.</li><li>Damage increased from 30 to 35.</li></ul></main>'''
        # Validate numeric base-health changes only; the generic Damage line needs review.
        db,new=p.ingest(html,BASE,{'entries':[]})
        status=db['liveEngine']['heroStatus']['Reaper']
        self.assertEqual(status['awaiting_review_count'],1)
        self.assertEqual(status['review_status'],'review_needed')
        self.assertEqual(status['last_verified_stat_source'],'official_patch')
        self.assertEqual(status['last_auto_verified_patch_date'],'2026-11-05')
        self.assertEqual(next(h for h in db['heroes'] if h['name']=='Reaper')['stats']['health']['current_value'],'300')
        self.assertEqual(next(h for h in db['heroes'] if h['name']=='Reaper')['stats']['total_hp']['current_value'],'300')
        self.assertEqual(status['last_blizzard_check_at'],db['liveEngine']['checked_at'])
        self.assertTrue(any(e['status']!='auto_verified' for e in new))

    def test_repeat_poll_does_not_refresh_verified_stat_timestamp(self):
        html='''<main><h2>November 5, 2026</h2><h3>Hero Updates</h3><h4>Damage</h4><h5>Reaper</h5><ul><li>Base health increased from 275 to 300.</li></ul></main>'''
        state={'entries':[]}
        first,_=p.ingest(html,BASE,state)
        verified_first=first['liveEngine']['heroStatus']['Reaper']['last_verified_stats_at']
        second,changes=p.ingest(html,BASE,state)
        self.assertEqual(changes,[])
        self.assertEqual(second['liveEngine']['heroStatus']['Reaper']['last_verified_stats_at'],verified_first)

    def test_no_pending_does_not_claim_official_stat_review(self):
        html='''<main><h2>November 5, 2026</h2><h3>Hero Updates</h3><h4>Damage</h4><h5>Reaper</h5></main>'''
        db,_=p.ingest(html,BASE,{'entries':[]})
        s=db['liveEngine']['heroStatus']['Reaper']
        self.assertEqual(s['review_status'],'no_pending_detected')
        self.assertEqual(s['last_verified_stat_source'],'seeded_reference')
        self.assertNotEqual(s['last_blizzard_check_at'],s['last_verified_stats_at'])

    def test_patch_text_corrections_do_not_double_count(self):
        html='''<main><h2>November 5, 2026</h2><h3>Stadium Updates</h3><h4>Damage</h4><h5>Reaper</h5><ul><li>Damage increased from 15 to 20.</li></ul></main>'''
        raw=p.parse_official(html,BASE['heroes'])[0]
        old=dict(raw,game_mode='standard',id='old-parser-id')
        db,new=p.ingest(html,BASE,{'entries':[old]})
        items=[e for e in db['liveEngine']['entries'] if e['hero']=='Reaper']
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['game_mode'],'stadium')
        self.assertEqual(new,[])

if __name__=='__main__':unittest.main()