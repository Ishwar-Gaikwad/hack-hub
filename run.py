#!/usr/bin/env python3
"""
DOGFOOD 2026 Official Hackathon Platform Acceptance Checker
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
    """Fallback TOML parser for basic tables, key-values, and string arrays."""
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
                val = val.strip()
                if val.startswith('[') and val.endswith(']'):
                    items = [x.strip().strip('"').strip("'") for x in val[1:-1].split(',') if x.strip()]
                    current_section[key] = items
                else:
                    val = val.strip('"').strip("'")
                    current_section[key] = val
    return config


def load_config(toml_path):
    if tomllib:
        try:
            with open(toml_path, "rb") as f:
                return tomllib.load(f)
        except Exception:
            pass
    return parse_simple_toml(toml_path)


class DogfoodAcceptanceChecker:
    def __init__(self, config_path):
        self.config = load_config(config_path)
        self.base_url = self.config.get("portal", {}).get("base_url", "http://localhost:5000").rstrip("/")
        self.routes = self.config.get("routes", {})
        self.auth = self.config.get("auth", {})
        self.tiers_cfg = self.config.get("tiers", {})
        self.claimed_tiers = self.tiers_cfg.get("claimed", ["T1"])
        if isinstance(self.claimed_tiers, str):
            self.claimed_tiers = [self.claimed_tiers]
        self.results = []
        self.server_proc = None

    def request(self, method, path, data=None, auth_header=None):
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        headers = {
            "Accept": "application/json, text/csv, */*",
            "Content-Type": "application/json"
        }
        if auth_header:
            headers["Authorization"] = auth_header

        req_body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_body, headers=headers, method=method.upper())

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                status_code = response.getcode()
                raw_body = response.read().decode("utf-8")
                content_type = response.headers.get("Content-Type", "")
                try:
                    parsed_json = json.loads(raw_body)
                except Exception:
                    parsed_json = {"raw": raw_body, "content_type": content_type}
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

    def check(self, check_id, description, passed):
        status_str = "PASS" if passed else "FAIL"
        dots = "." * max(1, (35 - len(description)))
        line = f"{check_id}  {description} {dots} {status_str}"
        self.results.append((check_id, description, passed, line))
        print(line)

    def ensure_server_running(self):
        c, _ = self.request("GET", "/api/health")
        if c == 200:
            return True
        c, _ = self.request("GET", "/health")
        if c == 200:
            return True

        # Attempt to start local server if not running
        server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server")
        env = os.environ.copy()
        env["PORT"] = "5000"
        env["NODE_ENV"] = "development"
        try:
            self.server_proc = subprocess.Popen(
                ["node", "src/index.js"],
                cwd=server_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            for _ in range(15):
                time.sleep(1)
                c1, _ = self.request("GET", "/api/health")
                if c1 == 200:
                    return True
                c2, _ = self.request("GET", "/health")
                if c2 == 200:
                    return True
        except Exception:
            pass
        return False

    def run_checks(self):
        print("DOGFOOD 2026 acceptance report")
        print(f"portal: {self.base_url}")
        print(f"claimed: {', '.join(self.claimed_tiers)}")
        print("fixtures: fixtures.json\n")

        self.ensure_server_running()

        # Load fixture data
        fixture_project_titles = ["HackHub Autonomous Workflow Orchestrator", "Visionary Defect Inspector"]
        fixture_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures.json")
        if os.path.exists(fixture_file):
            try:
                with open(fixture_file, 'r', encoding='utf-8') as f:
                    f_data = json.load(f)
                    titles = [p.get("title") for p in f_data.get("projects", []) if p.get("title")]
                    if titles:
                        fixture_project_titles = titles
            except Exception:
                pass

        # --- T1 Checks ---
        # Check 1 — Public gallery
        gallery_route = self.routes.get("gallery", "/projects")
        c_gal, r_gal = self.request("GET", gallery_route)
        self.check("T1", "gallery is public", c_gal == 200)

        # Check 2 — Fixture project appears
        projects_list = []
        if isinstance(r_gal, list):
            projects_list = r_gal
        elif isinstance(r_gal, dict):
            projects_list = r_gal.get("projects", [])
        
        found_fixture = False
        for p in projects_list:
            t = p.get("title", "") if isinstance(p, dict) else ""
            if any(ft.lower() in t.lower() or t.lower() in ft.lower() for ft in fixture_project_titles):
                found_fixture = True
                break
        self.check("T1", "project from fixtures shown", c_gal == 200 and found_fixture)

        # Check 3 — Closed event rejects submission
        submit_route = self.routes.get("submit", "/projects/new")
        part_auth = self.auth.get("participant", "")
        c_sub, _ = self.request("POST", submit_route, {"title": "Attempted Late Project"}, auth_header=part_auth)
        self.check("T1", "closed event refuses submissions", 400 <= c_sub < 500)

        # --- T2 Checks (if claimed) ---
        t2_passed = True
        if "T2" in self.claimed_tiers:
            # Check 4 — Judge sees own scores
            judge_route = self.routes.get("judge_scores", "/api/judge/scores")
            judge_a_auth = self.auth.get("judge_a", "")
            c_j4, _ = self.request("GET", judge_route, auth_header=judge_a_auth)
            self.check("T2", "judge sees own scores", c_j4 == 200)
            if c_j4 != 200:
                t2_passed = False

            # Check 5 — Judge cannot see another judge's scores
            peer_route = self.routes.get("peer_scores", "/api/judge/scores?judge=judge_a")
            judge_b_auth = self.auth.get("judge_b", "")
            c_j5, _ = self.request("GET", peer_route, auth_header=judge_b_auth)
            self.check("T2", "judge cannot see another judge's scores", c_j5 in (401, 403))
            if c_j5 not in (401, 403):
                t2_passed = False

            # Check 6 — Participant cannot access judge scores
            c_j6, _ = self.request("GET", judge_route, auth_header=part_auth)
            self.check("T2", "participant cannot access judge scores", c_j6 in (401, 403))
            if c_j6 not in (401, 403):
                t2_passed = False

            # Check 7 — Organizer can export CSV
            csv_route = self.routes.get("csv_export", "/api/export.csv")
            org_auth = self.auth.get("organizer", "")
            c_j7, r_j7 = self.request("GET", csv_route, auth_header=org_auth)
            is_csv = c_j7 == 200 and (
                "csv" in r_j7.get("content_type", "").lower() or
                "," in r_j7.get("raw", "")
            )
            self.check("T2", "organizer can export CSV", is_csv)
            if not is_csv:
                t2_passed = False

        # Summary verification
        t1_checks = [res[2] for res in self.results if res[0] == "T1"]
        t1_passed = len(t1_checks) == 3 and all(t1_checks)

        verified = []
        if t1_passed:
            verified.append("T1")
        if "T2" in self.claimed_tiers and t2_passed:
            verified.append("T2")

        claimed_str = ", ".join(self.claimed_tiers)
        verified_str = ", ".join(verified) if verified else "none"

        print(f"\nclaimed {claimed_str}, verified {verified_str}")

        all_claimed_verified = all(t in verified for t in self.claimed_tiers)
        return 0 if all_claimed_verified else 1

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
        exit_code = checker.run_checks()
    finally:
        checker.cleanup()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
