"""Exercise only disposable accounts/parties; never send public chat or touch another listing."""
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://localhost:3100'
users = []
members = []
checks = []


def request(path, body=None, token='', native=False, method=None):
    headers = {'Cache-Control': 'no-cache'}
    if native:
        headers['Origin'] = 'https://localhost'
    if token:
        if native:
            path += ('&' if '?' in path else '?') + 'token=' + urllib.parse.quote(token)
        else:
            headers['Authorization'] = 'Bearer ' + token
    if body is not None:
        headers['Content-Type'] = 'text/plain;charset=UTF-8'
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=45)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read()
    data = json.loads(raw) if raw else {}
    return response.status, data, response.headers


def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)


try:
    for path in ['/api/auth/me', '/api/rank', '/api/market', '/api/chat', '/api/party?code=QAONLY00']:
        status, data, headers = request(path)
        check('public read ' + path, status == 200 and 'error' not in data)
        check('new generation ' + path, headers.get('X-CERTZ-Online-Generation') == 'lilac-v1')
    status, _, headers = request('/api/auth/login', native=True, method='OPTIONS')
    check('APK preflight', status == 204 and headers.get('Access-Control-Allow-Origin') == 'https://localhost')
    check('old APK token expires', request('/api/auth/me', token='0' * 64, native=True)[0] == 401)
    check('fresh DB administrator ID cannot be claimed',
          request('/api/auth/register', {'id': 'admin', 'pw': secrets.token_urlsafe(24), 'name': '검증용'})[0] == 403)
    suffix = secrets.token_hex(4)
    for index in range(2):
        uid = 'qa_' + suffix + str(index)
        password = secrets.token_urlsafe(24)
        name = '검' + suffix[:5] + str(index)
        status, data, _ = request('/api/auth/register', {'id': uid, 'pw': password, 'name': name}, native=index == 1)
        check('register ' + str(index), status == 200 and data.get('user', {}).get('role') == 'user' and bool(data.get('token')))
        users.append({'id': uid, 'token': data['token'], 'name': name, 'claimed': False})
        status, data, _ = request('/api/auth/login', {'id': uid, 'pw': password}, native=index == 1)
        check('login ' + str(index), status == 200 and bool(data.get('token')))
        users[-1]['token'] = data['token']
        status, data, _ = request('/api/auth/me', token=data['token'], native=index == 1)
        check('session ' + str(index), status == 200 and data.get('user', {}).get('id') == uid)
        save = {'stage': 'village', 'lv': 1, 'playerName': name, 'gold': 1000, 'emerald': 0,
                'owned': ['weapon_1'] if index == 0 else [], 'accessories': []}
        token = users[-1]['token']
        check('cloud upload ' + str(index), request('/api/auth/cloud-save', {'data': save}, token, native=index == 1)[0] == 200)
        status, data, _ = request('/api/auth/cloud-save', token=token, native=index == 1)
        check('cloud restore ' + str(index), status == 200 and data.get('data', {}).get('gold') == 1000)
        claimed = '캐' + suffix[:5] + str(index)
        status, _, _ = request('/api/auth/claimname', {'name': claimed}, token)
        check('character name claim ' + str(index), status == 200)
        users[-1]['claimed'] = claimed
    seller, buyer = users
    status, data, _ = request('/api/rank', token=seller['token'])
    check('cloud save feeds ranking', status == 200 and any(row.get('name') == seller['name'] for row in data.get('list', [])))
    status, data, _ = request('/api/market/list', {'itemKey': 'weapon_1', 'up': 0, 'price': 100, 'qty': 1}, seller['token'])
    check('market escrow listing', status == 200 and bool(data.get('id')))
    listing = data['id']
    status, data, _ = request('/api/market/buy', {'id': listing}, buyer['token'], native=True)
    check('market purchase own QA listing', status == 200 and data.get('gold') == 900)
    status, _, _ = request('/api/market/collect', {}, seller['token'])
    check('market settlement', status == 200)
    status, data, _ = request('/api/auth/cloud-save', token=seller['token'])
    check('settlement persists', status == 200 and data.get('data', {}).get('gold') == 1090)
    status, data, _ = request('/api/auth/cloud-save', token=buyer['token'], native=True)
    check('purchased item persists', status == 200 and 'weapon_1' in data.get('data', {}).get('owned', []))
    cid = 'qa_' + secrets.token_hex(8)
    status, data, _ = request('/api/party', {'action': 'create', 'cid': cid, 'name': seller['name'], 'lv': 1}, native=True)
    check('private party create', status == 200 and bool(data.get('seat')))
    members.append({'cid': cid, 'seat': data['seat']})
    code = data['code']
    cid = 'qa_' + secrets.token_hex(8)
    status, data, _ = request('/api/party', {'action': 'join', 'cid': cid, 'code': code, 'name': buyer['name'], 'lv': 1})
    check('private party join', status == 200 and bool(data.get('seat')))
    members.append({'cid': cid, 'seat': data['seat']})
    status, data, _ = request('/api/party?code=' + code + '&qa=' + suffix)
    check('party membership read', status == 200 and len(data.get('party', {}).get('members', [])) == 2)
    status, data, headers = request('/api/chat?qa=' + suffix, native=True)
    check('APK chat read CORS', status == 200 and isinstance(data.get('list'), list) and headers.get('Access-Control-Allow-Origin') == 'https://localhost')
finally:
    cleanup_errors = []

    def clean(name, action):
        try:
            check(name, action())
        except Exception as error:
            cleanup_errors.append(name + ': ' + type(error).__name__)

    for member in reversed(members):
        clean('remove own QA party member', lambda: request('/api/party', {'action': 'leave', **member})[0] == 200)
    for user in users:
        if user['claimed']:
            clean('release own QA name', lambda: request('/api/auth/releasename', {'name': user['claimed']}, user['token'])[0] == 200)
        clean('delete disposable QA account', lambda: request('/api/auth/delete', {'confirm': 'DELETE'}, user['token'])[0] == 200)
        clean('deleted session revoked', lambda: request('/api/auth/me', token=user['token'])[0] == 401)
    assert not cleanup_errors, '; '.join(cleanup_errors)
print(json.dumps({'base': BASE, 'passed': len(checks), 'publicChatSent': False, 'testAccountsDeleted': len(users)}, ensure_ascii=False))
