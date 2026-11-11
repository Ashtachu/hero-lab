"""Optional channel-wide notifications. Never includes subscription PII."""
import json,os,sys,requests
from pathlib import Path
root=Path(__file__).resolve().parents[1]
events=json.loads((root/'state/new-events.json').read_text())
url=os.environ.get('PATCH_NOTIFICATION_WEBHOOK','')
if not url or not events:sys.exit(0)
# Only configured Discord webhook URLs; individual followers use local in-app subscriptions.
if not url.startswith('https://discord.com/api/webhooks/') and not url.startswith('https://discordapp.com/api/webhooks/'):
 raise ValueError('Unexpected webhook URL')
heroes=sorted({x['hero'] for x in events});approved=sum(x.get('status')=='auto_verified' for x in events)
content=f'Hero Lab: {len(events)} new Blizzard patch notes for {", ".join(heroes)}. {approved} validated stat edits; remaining entries pending review. See the updated Hero Lab Patch History.'
requests.post(url,json={'content':content[:1900]},timeout=15).raise_for_status()
