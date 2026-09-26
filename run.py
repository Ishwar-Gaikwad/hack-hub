#!/usr/bin/env python3
"""
DOGFOOD 2026 Hackathon Platform Acceptance Checker
Usage: python run.py .dogfood.toml
"""

import sys
import os
import json
import time
import subprocess
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None


def parse_simple_toml(filepath):
    """Fallback basic TOML parser for basic key-values and sections."""
    config = {}
    current_section = config
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('[') and line.endswith(']'):
                section_name = line[1:-1].strip()
                parts = section_name.split('.')
                curr = config
                for part in parts:
                    if part not in curr:
                        curr[part] = {}
                    curr = curr[part]
                current_section = curr
            elif '=' in line:
                key, val = line.split('=', 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                current_section[key] = val
    return config


def load_config(toml_path):
    if tomllib:
        with open(toml_path, "rb") as f:
            return tomllib.load(f)
    return parse_simple_toml(toml_path)


class DogfoodAcceptanceChecker:
    def __init__(self, config_path):
        self.config = load_config(config_path)
        self.base_url = self.config.get("portal", {}).get("base_url", "http://localhost:5000").rstrip("/")
        self.passed_checks = []
        self.failed_checks = []
        self.server_proc = None

    def request(self, method, path, data=None, token=None):
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        req_body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_body, headers=headers, method=method.upper())

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                raw_body = response.read().decode("utf-8")
                try:
                    parsed_json = json.loads(raw_body)
                except Exception:
                    parsed_json = {"raw": raw_body}
                return status_code, parsed_json
        except urllib.error.HTTPError as e:
            status_code = e.code
            raw_body = e.read().decode("utf-8")
            try:
                parsed_json = json.loads(raw_body)
            except Exception:
                parsed_json = {"raw": raw_body}
            return status_code, parsed_json
        except Exception as e:
            return 0, {"error": str(e)}

    def check(self, name, condition, details=""):
        if condition:
            print(f"  [PASS] {name}")
            self.passed_checks.append(name)
        else:
            print(f"  [FAIL] {name} - {details}")
            self.failed_checks.append((name, details))

    def ensure_server_running(self):
        code, _ = self.request("GET", "/api/health")
        if code == 200:
            return True

        print(f"Starting local server on {self.base_url}...")
        env = os.environ.copy()
        env["PORT"] = "5000"
        env["NODE_ENV"] = "development"
        
        # Start server background process if not already running
        server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server")
        try:
            self.server_proc = subprocess.Popen(
                ["node", "src/index.js"],
                cwd=server_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            # Wait for server to become responsive
            for _ in range(15):
                time.sleep(1)
                c, _ = self.request("GET", "/api/health")
                if c == 200:
                    print("Local server ready.")
                    return True
        except Exception as e:
            print(f"Failed to start server subprocess: {e}")
        return False

    def run_all_checks(self):
        print("=" * 60)
        print(" DOGFOOD 2026 ACCEPTANCE VERIFICATION RUNNER")
        print(f" Tier Claimed: {self.config.get('dogfood', {}).get('tier', 'T1')}")
        print(f" Base URL:     {self.base_url}")
        print(f" Timestamp:    {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)

        # Ensure server is running before tests
        self.ensure_server_running()

        # 1. Health Verification
        print("\n1. Health & Platform Foundation")
        c1, res1 = self.request("GET", "/health")
        self.check("Health endpoint /health returns 200", c1 == 200, f"Got status {c1}")
        c2, res2 = self.request("GET", "/api/health")
        self.check("Health endpoint /api/health returns 200", c2 == 200, f"Got status {c2}")

        # 2. Authentication & RBAC Verification
        print("\n2. Authentication & Role-Based Access Control")
        org_cfg = self.config.get("auth", {}).get("organizer", {})
        c_org, r_org = self.request("POST", "/api/auth/login", {
            "email": org_cfg.get("email", "organizer@hackhub.local"),
            "password": org_cfg.get("password", "password123")
        })
        org_token = r_org.get("session", {}).get("token")
        self.check("Organizer authentication", c_org == 200 and bool(org_token), f"Status: {c_org}")

        judge_cfg = self.config.get("auth", {}).get("judge", {})
        c_jdg, r_jdg = self.request("POST", "/api/auth/login", {
            "email": judge_cfg.get("email", "judge@hackhub.local"),
            "password": judge_cfg.get("password", "password123")
        })
        judge_token = r_jdg.get("session", {}).get("token")
        self.check("Judge authentication", c_jdg == 200 and bool(judge_token), f"Status: {c_jdg}")

        part_cfg = self.config.get("auth", {}).get("participant", {})
        c_prt, r_prt = self.request("POST", "/api/auth/login", {
            "email": part_cfg.get("email", "alice@hackhub.local"),
            "password": part_cfg.get("password", "password123")
        })
        part_token = r_prt.get("session", {}).get("token")
        self.check("Participant authentication", c_prt == 200 and bool(part_token), f"Status: {c_prt}")

        # 3. Public Gallery Access (Unauthenticated)
        print("\n3. Public Gallery Verification (Unauthenticated)")
        gallery_route = self.config.get("portal", {}).get("gallery_route", "/api/projects")
        c_gal, r_gal = self.request("GET", gallery_route)
        self.check("Public gallery accessible without authentication", c_gal == 200, f"Got status {c_gal}")

        projects = r_gal.get("projects", [])
        self.check("Gallery contains submitted projects", isinstance(projects, list) and len(projects) > 0, f"Found {len(projects)} projects")

        # Check for presence of fixture project
        titles = [p.get("title", "") for p in projects]
        has_fixture_title = any("Autonomous" in t or "Workflow" in t or "HackHub" in t or "Defect" in t for t in titles)
        self.check("Fixture project appears in public gallery response", has_fixture_title, f"Titles found: {titles}")

        # Check that draft projects are excluded
        all_submitted = all(p.get("status") == "submitted" for p in projects)
        self.check("Draft projects strictly excluded from gallery", all_submitted, "Non-submitted project found")

        # 4. Search and Filter
        print("\n4. Search and Filter Functionality")
        c_srch, r_srch = self.request("GET", f"{gallery_route}?q=autonomous")
        srch_projects = r_srch.get("projects", [])
        self.check("Search query filter (q=autonomous)", c_srch == 200 and len(srch_projects) >= 1, f"Count: {len(srch_projects)}")

        # 5. Full Lifecycle & Deadline Enforcement
        print("\n5. Lifecycle & Server-Side Deadline Enforcement")
        # Create fresh past event with organizer
        past_event_payload = {
            "name": f"Automated Deadline Test Event {int(time.time())}",
            "startDate": "2020-01-01T00:00:00.000Z",
            "submissionDeadline": "2020-01-10T00:00:00.000Z",
            "endDate": "2020-01-15T00:00:00.000Z"
        }
        c_ev, r_ev = self.request("POST", "/api/events", past_event_payload, token=org_token)
        past_ev_id = r_ev.get("event", {}).get("_id")
        self.check("Event creation with explicit dates", c_ev == 201 and bool(past_ev_id), f"Status: {c_ev}")

        if past_ev_id:
            # Create track
            c_tr, r_tr = self.request("POST", f"/api/events/{past_ev_id}/tracks", {"name": "Deadline Track"}, token=org_token)
            past_tr_id = r_tr.get("track", {}).get("_id")

            # Create team with participant
            c_tm, r_tm = self.request("POST", f"/api/events/{past_ev_id}/teams", {"name": "Deadline Team"}, token=part_token)
            past_tm_id = r_tm.get("team", {}).get("_id")

            # Attempt project creation after deadline -> must reject 4xx
            c_proj_late, r_proj_late = self.request("POST", "/api/projects", {
                "eventId": past_ev_id,
                "teamId": past_tm_id,
                "trackId": past_tr_id,
                "title": "Rejected Late Project"
            }, token=part_token)
            self.check(
                "Server rejects project creation after submission deadline with 4xx",
                400 <= c_proj_late < 500,
                f"Got status {c_proj_late}, body: {r_proj_late}"
            )

        print("\n" + "=" * 60)
        print(f" ACCEPTANCE SUMMARY: {len(self.passed_checks)} PASSED, {len(self.failed_checks)} FAILED")
        print("=" * 60)

        if self.failed_checks:
            print("\nFailures:")
            for name, err in self.failed_checks:
                print(f" - {name}: {err}")
            return 1
        else:
            print("\nALL T1 ACCEPTANCE CRITERIA SATISFIED SUCCESSFULLY!")
            return 0

    def cleanup(self):
        if self.server_proc:
            self.server_proc.terminate()


def main():
    config_file = sys.argv[1] if len(sys.argv) > 1 else ".dogfood.toml"
    if not os.path.exists(config_file):
        print(f"Error: Configuration file '{config_file}' not found.")
        sys.exit(1)

    checker = DogfoodAcceptanceChecker(config_file)
    exit_code = 1
    try:
        exit_code = checker.run_all_checks()
    finally:
        checker.cleanup()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
