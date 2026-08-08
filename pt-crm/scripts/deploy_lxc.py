"""
One-shot deploy FloorScribe to a remote host via SSH.

All host/user/password values come from environment variables only
(never commit secrets or private IPs).

  set FLOORSCRIBE_DEPLOY_HOST=...
  set FLOORSCRIBE_DEPLOY_USER=root
  set FLOORSCRIBE_DEPLOY_PASSWORD=...
  set FLOORSCRIBE_DEPLOY_PORT=4000
  python scripts/deploy_lxc.py
"""
from __future__ import annotations

import base64
import io
import os
import secrets
import tarfile
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("FLOORSCRIBE_DEPLOY_HOST", "").strip()
USER = os.environ.get("FLOORSCRIBE_DEPLOY_USER", "root").strip()
PASSWORD = os.environ.get("FLOORSCRIBE_DEPLOY_PASSWORD", "")
PORT = int(os.environ.get("FLOORSCRIBE_DEPLOY_PORT", "4000"))
REMOTE = os.environ.get("FLOORSCRIBE_DEPLOY_DIR", "/opt/floorscribe")
# Public site URL (e.g. https://floorscribe.com). Prefer over http://host:port when set.
APP_URL = os.environ.get("FLOORSCRIBE_DEPLOY_APP_URL", "").strip()

LOCAL = Path(__file__).resolve().parents[1]

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "data",
    "backups",
    ".git",
    ".turbo",
}
EXCLUDE_NAMES = {".env", "tsconfig.tsbuildinfo"}


def should_exclude(path: Path) -> bool:
    rel = path.relative_to(LOCAL)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return True
    if path.name in EXCLUDE_NAMES:
        return True
    if path.name.endswith((".log", ".tsbuildinfo")):
        return True
    return False


def main() -> None:
    if not HOST:
        raise SystemExit("Set FLOORSCRIBE_DEPLOY_HOST")
    if not PASSWORD:
        raise SystemExit("Set FLOORSCRIBE_DEPLOY_PASSWORD")
    app_url = APP_URL or f"http://{HOST}:{PORT}"

    print(f"Connecting to {USER}@{HOST}...")
    # Prefer Transport + password (some hosts fail SSHClient.connect quirks)
    transport = paramiko.Transport((HOST, 22))
    transport.connect()
    transport.auth_password(USER, PASSWORD)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client._transport = transport  # noqa: SLF001 — intentional after auth
    print("SSH OK")

    def run(cmd: str, check: bool = True, timeout: int = 600):
        print(f"$ {cmd}")
        _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        if out.strip():
            print(out[-5000:] if len(out) > 5000 else out)
        if err.strip():
            print("[stderr]", err[-2500:] if len(err) > 2500 else err)
        if check and code != 0:
            raise SystemExit(f"Command failed ({code}): {cmd}")
        return code, out, err

    code, out, _ = run(
        "command -v docker >/dev/null && docker --version || echo NO_DOCKER",
        check=False,
    )
    if "NO_DOCKER" in out:
        print("Installing Docker...")
        run("apt-get update -y", timeout=300)
        run("apt-get install -y ca-certificates curl git", timeout=300)
        run("curl -fsSL https://get.docker.com | sh", timeout=600)
        run("systemctl enable --now docker")
    else:
        print("Docker present")

    run("docker compose version", check=False)

    print("Packaging source...")
    buf = io.BytesIO()
    count = 0
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                p = Path(root) / f
                if should_exclude(p):
                    continue
                arc = p.relative_to(LOCAL).as_posix()
                tar.add(p, arcname=arc)
                count += 1
    data = buf.getvalue()
    print(f"Packed {count} files ({len(data) / 1024 / 1024:.1f} MB)")

    sftp = client.open_sftp()
    run(f"mkdir -p {REMOTE} /tmp")
    remote_tar = "/tmp/floorscribe-deploy.tgz"
    with sftp.file(remote_tar, "wb") as rf:
        rf.write(data)
    print("Uploaded archive")

    run(
        f"rm -rf {REMOTE}.new && mkdir -p {REMOTE}.new "
        f"&& tar -xzf {remote_tar} -C {REMOTE}.new"
    )
    run(
        f"if [ -d {REMOTE} ]; then rm -rf {REMOTE}.bak; "
        f"mv {REMOTE} {REMOTE}.bak || true; fi; "
        f"mv {REMOTE}.new {REMOTE}"
    )

    auth_secret = base64.b64encode(secrets.token_bytes(48)).decode()
    code, prev, _ = run(
        f"grep -E '^AUTH_SECRET=' {REMOTE}.bak/.env 2>/dev/null || true",
        check=False,
    )
    if prev.strip().startswith("AUTH_SECRET=") and len(prev.strip()) > 20:
        auth_secret = prev.strip().split("=", 1)[1].strip()
        print("Reusing existing AUTH_SECRET")

    env_body = (
        f"AUTH_SECRET={auth_secret}\n"
        f"APP_URL={app_url}\n"
        f"FLOORSCRIBE_PORT={PORT}\n"
        f"NODE_ENV=production\n"
    )
    with sftp.file(f"{REMOTE}/.env", "w") as ef:
        ef.write(env_body)
    print(f"Wrote .env (APP_URL={app_url}, PORT={PORT})")
    sftp.close()

    run(
        f"if command -v ufw >/dev/null; then ufw allow {PORT}/tcp || true; fi",
        check=False,
    )
    # iptables open if needed (many LXCs have no ufw)
    run(
        f"iptables -C INPUT -p tcp --dport {PORT} -j ACCEPT 2>/dev/null "
        f"|| iptables -I INPUT -p tcp --dport {PORT} -j ACCEPT 2>/dev/null || true",
        check=False,
    )

    print("Building and starting container (may take several minutes)...")
    run(f"cd {REMOTE} && docker compose down || true", check=False)
    run(f"cd {REMOTE} && docker compose up -d --build", timeout=1200)
    run(f"cd {REMOTE} && docker compose ps")
    time.sleep(8)
    run(f"curl -sS http://127.0.0.1:{PORT}/api/health || true", check=False)
    run(f"curl -sS http://{HOST}:{PORT}/api/health || true", check=False)

    print("\n=== DEPLOY DONE ===")
    print(f"Open: {app_url}")
    print("Demo: pt@demo.local / trainer123")
    client.close()
    try:
        transport.close()
    except Exception:
        pass


if __name__ == "__main__":
    main()
