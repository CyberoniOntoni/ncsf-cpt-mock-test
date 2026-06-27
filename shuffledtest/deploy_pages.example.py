"""Example deploy helper — copy to deploy_pages.py and set env vars locally.

Do not commit deploy_pages.py (it is gitignored).
"""
import json
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = os.environ.get("CF_PAGES_PROJECT", "ncsf-mock-exam")
DOMAIN = os.environ.get("CF_PAGES_DOMAIN", "ncsf.50bar.app")
ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
ROOT = Path(__file__).resolve().parent


def load_token():
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if token:
        return token
    raise SystemExit(
        "Set CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID for domain API calls)."
    )


def api(method, path, body=None):
    if not ACCOUNT_ID:
        raise SystemExit("Set CLOUDFLARE_ACCOUNT_ID for Cloudflare API calls.")
    token = load_token()
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {"success": False, "status": exc.code, "errors": exc.read().decode("utf-8", errors="replace")}


def run_deploy():
    cmd = (
        f"npx wrangler pages deploy . --project-name={PROJECT} "
        "--branch=main --commit-dirty=true"
    )
    subprocess.run(cmd, cwd=ROOT, check=True, shell=True)


def main():
    run_deploy()
    print(f"\nPages URL: https://{PROJECT}.pages.dev/")
    print(f"Custom domain: https://{DOMAIN}/")


if __name__ == "__main__":
    main()