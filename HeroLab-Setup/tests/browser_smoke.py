from pathlib import Path
from playwright.sync_api import sync_playwright
import threading,functools,http.server,socketserver
class Server(socketserver.TCPServer): allow_reuse_address=True
server=Server(("127.0.0.1",0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1]/"site")))
threading.Thread(target=server.serve_forever,daemon=True).start()
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for size in [(1440,900),(390,844)]:
  page=browser.new_page(viewport={'width':size[0],'height':size[1]},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_address[1]}/index.html',wait_until='domcontentloaded')
  page.locator('#hero-follow-trigger').click(force=True)
  assert page.locator('#live-follow-dialog').is_visible()
  assert page.locator('#live-follow-list label').count()==53
  page.locator('#live-follow-list label').filter(has_text='Mizuki').first.locator('input').check(force=True)
  assert page.evaluate("JSON.parse(localStorage.getItem('heroLabFollowedHeroes')).includes('Mizuki')")
  page.locator('#live-follow-close').click()
  assert not page.locator('#live-follow-dialog').is_visible()
  assert not errors,errors
  print('OK',size, 'follow dialog / hero toggles / close / no JS exceptions')
  page.close()
 browser.close()
