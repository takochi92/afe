#!/usr/bin/env python3
"""マイ金庫 同期サーバー。暗号化済みデータを預かるだけ（復号できない）。標準ライブラリのみ。"""
import hmac, json, os, shutil, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DATA = Path(os.environ.get("VAULT_DATA", "/data")); DATA.mkdir(parents=True, exist_ok=True)
BACKUPS = DATA / "backups"; BACKUPS.mkdir(exist_ok=True)
STATE = DATA / "vault.json"
PAGE = next(p for p in (Path(__file__).parent / "index.html", Path(__file__).parent.parent / "index.html") if p.exists())
TOKEN = os.environ.get("VAULT_TOKEN", "")
KEEP = int(os.environ.get("VAULT_KEEP", "60"))
MAX = 5 * 1024 * 1024
if len(TOKEN) < 24:
    raise SystemExit("VAULT_TOKEN は24文字以上で設定してください")

def load():
    return json.loads(STATE.read_text()) if STATE.exists() else {"version": 0, "blob": None}

class H(BaseHTTPRequestHandler):
    server_version = "vault"
    def log_message(self, *a): pass
    def send(self, code, body=b"", ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff"); self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def authed(self):
        got = self.headers.get("Authorization", "")
        return hmac.compare_digest(got.encode(), ("Bearer " + TOKEN).encode())
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            return self.send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        if self.path != "/vault": return self.send(404)
        if not self.authed(): return self.send(401)
        s = load()
        if s["blob"] is None: return self.send(404, b'{"version":0}')
        self.send(200, json.dumps(s).encode())
    def do_PUT(self):
        if self.path != "/vault": return self.send(404)
        if not self.authed(): return self.send(401)
        n = int(self.headers.get("Content-Length", "0"))
        if n <= 0 or n > MAX: return self.send(413)
        try:
            blob = json.loads(self.rfile.read(n))
            assert all(isinstance(blob.get(k), str) for k in ("salt", "iv", "data"))
        except Exception: return self.send(400)
        cur = load()
        if self.headers.get("If-Match") != str(cur["version"]):
            return self.send(409, json.dumps({"version": cur["version"]}).encode())
        if STATE.exists():
            shutil.copy2(STATE, BACKUPS / f"vault-{time.strftime('%Y%m%d-%H%M%S')}-v{cur['version']}.json")
            for old in sorted(BACKUPS.glob("vault-*.json"))[:-KEEP]: old.unlink()
        new = {"version": cur["version"] + 1, "blob": blob}
        tmp = STATE.with_suffix(".tmp"); tmp.write_text(json.dumps(new)); os.replace(tmp, STATE)
        self.send(200, json.dumps({"version": new["version"]}).encode())

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
