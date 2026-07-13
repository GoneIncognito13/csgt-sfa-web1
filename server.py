import urllib.request, urllib.parse, urllib.error
import json, os, uuid, threading, time
from datetime import datetime, timedelta
from flask import Flask, request, send_from_directory, Response

app = Flask(__name__, static_folder='.')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
GAS_URL = 'https://script.google.com/macros/s/AKfycbyQK2h0DgVo00gyaLCg7Aff5F9LinzE22eRjh1zN4IZwqEm_TB0deJ1MGzwUKDP3ZJ5/exec'
API_KEY = 'asdsaAscvlllwiFFa'

def gas_request(params_dict):
    params = urllib.parse.urlencode(params_dict)
    url = f'{GAS_URL}?{params}'
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, method='GET')
    req.add_header('User-Agent', 'Mozilla/5.0')
    req.add_header('Accept', 'application/json')
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        return json.loads(resp.read().decode())

def cleanup_old_selfies():
    try:
        data = gas_request({'key': API_KEY, 'action': 'list', 'sheet': 'FirstLastCalls'})
        entries = data.get('data', [])
        cutoff = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        deleted = 0
        for entry in entries:
            entry_date = entry.get('Date', '')
            if entry_date and entry_date < cutoff:
                gas_request({'key': API_KEY, 'action': 'delete', 'sheet': 'FirstLastCalls', 'idColumn': 'CallID', 'idValue': entry.get('CallID', '')})
                deleted += 1
        if deleted > 0:
            print(f"Cleanup: deleted {deleted} old selfies")
        return deleted
    except Exception as e:
        print(f"Cleanup error: {e}")
        return 0

def scheduled_cleanup():
    while True:
        time.sleep(3600)
        cleanup_old_selfies()

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if path.startswith('uploads/'):
        return send_from_directory(UPLOAD_DIR, path.replace('uploads/', ''))
    return send_from_directory(BASE_DIR, path)

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return json.dumps({'success': False, 'error': 'No file'}), 400
    f = request.files['file']
    ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else 'jpg'
    name = str(uuid.uuid4()) + '.' + ext
    f.save(os.path.join(UPLOAD_DIR, name))
    url = request.host_url.rstrip('/') + '/uploads/' + name
    return json.dumps({'success': True, 'url': url})

@app.route('/api/cleanup')
def api_cleanup():
    count = cleanup_old_selfies()
    return json.dumps({'success': True, 'deleted': count})

@app.route('/api/', defaults={'path': ''})
@app.route('/api/<path:path>')
def api_proxy(path):
    query = request.query_string.decode('utf-8') if request.query_string else ''
    if request.method == 'POST':
        body = request.get_data(as_text=True)
        if body: query += '&' + body
    url = f'{GAS_URL}?{query}'
    try:
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        gas_req = urllib.request.Request(url, method='GET')
        gas_req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        gas_req.add_header('Accept', 'application/json')
        with urllib.request.urlopen(gas_req, timeout=120, context=ctx) as resp:
            return Response(resp.read(), mimetype='application/json')
    except urllib.error.HTTPError as e:
        return json.dumps({'success': False, 'error': f'HTTP {e.code}', 'detail': e.read().decode('utf-8', errors='replace')[:500]}), 502
    except urllib.error.URLError as e:
        return json.dumps({'success': False, 'error': f'Connection error: {str(e.reason)}'}), 502
    except Exception as e:
        return json.dumps({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    import sys
    print("Running initial cleanup...")
    cleanup_old_selfies()
    t = threading.Thread(target=scheduled_cleanup, daemon=True)
    t.start()
    port = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8080))
    print(f"Server starting on port {port}")
    app.run(host='0.0.0.0', port=port)
