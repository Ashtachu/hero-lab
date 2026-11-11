import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import patch_engine as p
ROOT=Path(__file__).resolve().parents[1]
class PatchTests(unittest.TestCase):
 def setUp(self):self.db=p.read_json(ROOT/'state/baseline.json',{})
 def test_official_structure_and_pending_perk(self):
  fixture='''<html><body><main><h2>November 3, 2026</h2><h3>Hero Updates</h3><h4>Tank</h4><h5>Vendetta</h5><h6>Apex Bloodlust – Power</h6><ul><li>Lifesteal reduced to 3% (Down from 4%).</li></ul><h6>Rampant Onslaught – Power</h6><ul><li>Eliminations per increased stack of Onslaught increased to 3 (Up from 2).</li></ul></main></body></html>'''
  x=p.parse_official(fixture,self.db['heroes']);self.assertEqual(len(x),2)
  self.assertEqual(x[0]['hero'],'Vendetta');self.assertEqual(x[0]['old_value'],4)
  self.assertNotEqual(p.validate(x[0],self.db)['status'],'auto_verified')
 def test_empty_page_fails_closed(self):
  with self.assertRaises(RuntimeError):p.parse_official('<body><main><h2>Patch Notes</h2></main></body>',self.db['heroes'])
 def test_mismatched_baseline_not_overwritten(self):
  e=dict(status='parsed_pending_validation',metric='Armor',game_mode='standard',ability=None,hero='D.Va',old_value=999,new_value=200)
  self.assertNotEqual(p.validate(e,self.db)['status'],'auto_verified')
 def test_parser_never_treats_bugfix_as_balance(self):
  fixture='''<body><main><h2>November 3, 2026</h2><h3>Bug Fixes</h3><h5>Mizuki</h5><ul><li>Fixed a bug with payload collisions.</li></ul></main></body>'''
  self.assertFalse(p.parse_official(fixture,self.db['heroes']))
if __name__=='__main__':unittest.main()
