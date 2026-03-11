"""
bedrock_sync_agent.py  —  Agent 1: Data Sync Agent
---------------------------------------------------
Part of the three-agent Bedrock layer:
  Agent 1 (this file)  — Data Sync Agent: daily delta packages + CDN publish
  Agent 2              — Inference Agent: on-demand LLM for Tier 1 devices (bedrock_inference_agent.py)
  Agent 3              — Knowledge Base Agent: RAG over clinical dataset (bedrock_kb_agent.py)

Runs daily on AWS (Lambda / ECS Scheduled Task / EventBridge).

Responsibilities:
  1. Fetch latest Jan Aushadhi prices (PMBJP catalogue)
  2. Check for ICMR / NTEP / WHO-IN guideline updates
  3. Generate delta package vs. current published version
  4. Upload delta + full package to S3 for ALL model variants
  5. Publish new sync_manifest.json to CDN origin

Model updates are multi-variant: both gemma3-1b and gemma3-4b may be published
in the same manifest run. Each variant is keyed by its id in model_variants.json.

Environment variables required:
  S3_BUCKET          e.g. dhanwantariai-updates
  CDN_ORIGIN_BUCKET  e.g. dhanwantariai-cdn-origin
  DISEASE_DB_KEY     path to current master JSON in S3
  AWS_REGION         e.g. ap-south-1

Run locally (dry-run):
  python3 sync/bedrock_sync_agent.py --dry-run
"""

import argparse
import gzip
import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# ── Optional AWS imports (not needed for dry-run) ──────────────────────────
try:
    import boto3
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False


TODAY = datetime.now(timezone.utc).strftime('%Y%m%d')
BASE  = Path(__file__).parent.parent   # repo root


# ══════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def gzip_file(src: Path, dest: Path) -> None:
    with open(src, 'rb') as f_in, gzip.open(dest, 'wb') as f_out:
        shutil.copyfileobj(f_in, f_out)


def load_json(path: Path) -> dict:
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(data: dict, path: Path) -> None:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ══════════════════════════════════════════════════════════════════════════
# 1. Price updater — fetches PMBJP catalogue
# ══════════════════════════════════════════════════════════════════════════

def fetch_latest_prices(current_prices: dict) -> tuple[dict, list[str]]:
    """
    Fetch latest Jan Aushadhi (PMBJP) prices.
    Returns (updated_price_dict, list_of_changed_drug_names).

    In production: HTTP request to PMBJP public API or scrape
    pmbjp.gov.in/product-list. Here we stub it.
    """
    # ── STUB — replace with real HTTP fetch ────────────────────────────────
    # import requests
    # response = requests.get('https://pmbjp.gov.in/api/products', timeout=30)
    # latest = {item['name']: item['mrp'] for item in response.json()['products']}
    latest = current_prices.copy()  # No-op in stub

    changes = [
        drug for drug, price in latest.items()
        if current_prices.get(drug) != price
    ]
    return latest, changes


# ══════════════════════════════════════════════════════════════════════════
# 2. Guideline updater — checks ICMR / NTEP / WHO-IN
# ══════════════════════════════════════════════════════════════════════════

def check_guideline_updates(current_db: dict) -> tuple[dict, list[str]]:
    """
    Check for updated clinical protocols from:
      - NTEP (National Tuberculosis Elimination Programme)
      - ICMR (Diabetes, HTN, CV guidelines)
      - WHO-IN Country office
      - NPCDCS drug lists

    Returns (possibly_updated_db, list_of_changed_disease_ids).

    In production: parse RSS feeds / API endpoints maintained by those bodies,
    or ingest from a curated internal knowledge update feed maintained by the
    DhanwantariAI clinical team.
    """
    # ── STUB — clinical team pushes updates to S3 input bucket ────────────
    changed_ids: list[str] = []
    return current_db, changed_ids


# ══════════════════════════════════════════════════════════════════════════
# 3. Delta generator — RFC 6902 style disease-level diff
# ══════════════════════════════════════════════════════════════════════════

def generate_disease_db_delta(old_db: dict, new_db: dict) -> dict:
    """
    Disease-level delta: only include disease objects that changed.
    Format:
      {
        "from_version": "20260227",
        "to_version":   "20260306",
        "replaced":     [ <full disease objects that changed> ],
        "added":        [ <new disease objects> ],
        "removed":      [ "disease_id_1", ... ]
      }

    Clients apply: replace matching IDs, append added, delete removed.
    No partial-field patching — always full object replacement per disease.
    This keeps client-side apply logic trivially simple.
    """
    old_map = {d['id']: d for d in old_db.get('diseases', [])}
    new_map = {d['id']: d for d in new_db.get('diseases', [])}

    replaced = []
    added    = []
    removed  = []

    for did, new_disease in new_map.items():
        if did not in old_map:
            added.append(new_disease)
        elif json.dumps(old_map[did], sort_keys=True) != json.dumps(new_disease, sort_keys=True):
            replaced.append(new_disease)

    for did in old_map:
        if did not in new_map:
            removed.append(did)

    # Also check top-level non-disease sections
    other_changes: dict = {}
    for key in ('scoring_algorithm', 'user_profile_schema', 'hereditary_diseases'):
        if json.dumps(old_db.get(key), sort_keys=True) != json.dumps(new_db.get(key), sort_keys=True):
            other_changes[key] = new_db.get(key)

    from_ver = old_db.get('metadata', {}).get('version', 'unknown')
    to_ver   = TODAY

    return {
        'from_version':    from_ver,
        'to_version':      to_ver,
        'replaced':        replaced,
        'added':           added,
        'removed':         removed,
        'other_changes':   other_changes,
        'total_changes':   len(replaced) + len(added) + len(removed) + len(other_changes),
    }


# ══════════════════════════════════════════════════════════════════════════
# 4. Manifest builder
# ══════════════════════════════════════════════════════════════════════════

CDN_BASE = 'https://cdn.dhanwantariai.in'

def build_manifest(
    db_version:               str,
    db_full_gz:               Path,
    db_delta_gz:              Path | None,
    prev_db_version:          str | None,
    price_version:            str,
    price_full_gz:            Path,
    price_delta_gz:           Path | None,
    prev_price_version:       str | None,
    model_variants_to_publish: list[dict] | None = None,  # None = no model update today
    min_app_version:          str = '1.0.0',
) -> dict:
    """
    model_variants_to_publish: list of variant dicts from pending_model_update.json.
    Each dict must have keys:
      id, version, litert_file, gguf_file,
      litert_size_bytes, gguf_size_bytes, changelog (optional)
    The manifest publishes one entry per variant under packages.model_variants.<id>.
    """

    def pkg_url(name: str) -> str:
        return f'{CDN_BASE}/updates/{name}'

    manifest: dict = {
        '_schema_version':  '1.0',
        'manifest_version': f'{TODAY}-001',
        'generated_at':     datetime.now(timezone.utc).isoformat(),
        'min_app_version':  min_app_version,
        'packages': {},
        'health_worker_offline_rules': {
            '0_to_7_days':    {'disease_db': 'delta', 'price_catalog': 'delta',    'model_weights': 'notify'},
            '8_to_30_days':   {'disease_db': 'delta', 'price_catalog': 'full',     'model_weights': 'notify_defer_ok'},
            '31_to_90_days':  {'disease_db': 'full',  'price_catalog': 'full',     'model_weights': 'notify_with_staleness_warning'},
            'over_90_days':   {'disease_db': 'full',  'price_catalog': 'full',     'model_weights': 'prominent_banner'},
        }
    }

    # ── Disease DB package ────────────────────────────────────────────────
    db_pkg: dict = {
        'version':    db_version,
        'sha256':     sha256_file(db_full_gz),
        'size_bytes': db_full_gz.stat().st_size,
        'url':        pkg_url(db_full_gz.name),
        'sync_policy': {
            'auto_update':          True,
            'prompt_user':          False,
            'wifi_only':            False,
            'apply_to':             'new_sessions_and_existing_data',
            'conflict_resolution':  'server_wins',
            'preserve_historical_sessions': False,  # disease content is not session-authored
        }
    }
    if db_delta_gz and db_delta_gz.exists() and prev_db_version:
        db_pkg['delta_from_version'] = prev_db_version
        db_pkg['delta_url']          = pkg_url(db_delta_gz.name)
        db_pkg['delta_sha256']       = sha256_file(db_delta_gz)
        db_pkg['delta_size_bytes']   = db_delta_gz.stat().st_size
    manifest['packages']['disease_db'] = db_pkg

    # ── Price catalogue package ───────────────────────────────────────────
    price_pkg: dict = {
        'version':    price_version,
        'sha256':     sha256_file(price_full_gz),
        'size_bytes': price_full_gz.stat().st_size,
        'url':        pkg_url(price_full_gz.name),
        'sync_policy': {
            'auto_update':                True,
            'prompt_user':                False,
            'wifi_only':                  False,
            'apply_to':                   'new_sessions_only',
            'conflict_resolution':        'server_wins_for_future',
            'preserve_historical_sessions': True,  # KEY: past session prices stay frozen
        }
    }
    if price_delta_gz and price_delta_gz.exists() and prev_price_version:
        price_pkg['delta_from_version'] = prev_price_version
        price_pkg['delta_url']          = pkg_url(price_delta_gz.name)
        price_pkg['delta_sha256']       = sha256_file(price_delta_gz)
        price_pkg['delta_size_bytes']   = price_delta_gz.stat().st_size
    manifest['packages']['price_catalog'] = price_pkg

    # ── Model variants (only published when flag file present) ───────────
    # manifest.packages.model_variants is a dict keyed by variant id, e.g.:
    #   "gemma3-4b-dhanwantari-ft": { version, litert_url, gguf_url, ... }
    #   "gemma3-1b-dhanwantari-ft": { ... }
    # Clients select which variant to download via model_variants.json selection policy.
    if model_variants_to_publish:
        manifest['packages']['model_variants'] = {}
        for v in model_variants_to_publish:
            vid          = v['id']                        # e.g. 'gemma3-4b-dhanwantari-ft'
            litert_mb    = v['litert_size_bytes'] // 1_048_576
            manifest['packages']['model_variants'][vid] = {
                'version':               v['version'],
                'litert_url':            pkg_url(v['litert_file']),
                'litert_sha256':         v.get('litert_sha256', ''),
                'litert_size_bytes':     v['litert_size_bytes'],
                'gguf_url':              pkg_url(v['gguf_file']),
                'gguf_sha256':           v.get('gguf_sha256', ''),
                'gguf_size_bytes':       v['gguf_size_bytes'],
                'changelog':             v.get('changelog', ''),
                'sync_policy': {
                    'auto_update':           False,
                    'prompt_user':           True,
                    'wifi_only':             v.get('require_wifi', True),
                    'apply_to':              'new_sessions_only',
                    'conflict_resolution':   'user_decides',
                    'allow_defer':           True,
                    'max_defer_days':        30,
                    'background_download':   True,
                    'resume_on_reconnect':   True,
                    'prompt_message_en':     (
                        f'A better version of DhanwantariAI is available — '
                        f'download on Wi-Fi? ({litert_mb} MB)'
                    ),
                    'prompt_message_hi':     (
                        f'DhanwantariAI का बेहतर संस्करण उपलब्ध है — '
                        f'Wi-Fi पर डाउनलोड करें? ({litert_mb} MB)'
                    ),
                }
            }

    return manifest


# ══════════════════════════════════════════════════════════════════════════
# 5. S3 uploader
# ══════════════════════════════════════════════════════════════════════════

def upload_to_s3(local_path: Path, bucket: str, key: str, dry_run: bool) -> None:
    if dry_run:
        print(f'  [DRY-RUN] Would upload {local_path} → s3://{bucket}/{key}')
        return
    if not AWS_AVAILABLE:
        raise RuntimeError('boto3 not installed. Run: pip install boto3')
    s3 = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))
    content_type = 'application/gzip' if local_path.suffix == '.gz' else 'application/json'
    extra = {'ContentType': content_type}
    if local_path.suffix in ('.gz', '.gguf'):
        extra['ContentEncoding'] = 'gzip' if local_path.suffix == '.gz' else 'identity'
    s3.upload_file(str(local_path), bucket, key, ExtraArgs=extra)
    print(f'  Uploaded s3://{bucket}/{key}  ({local_path.stat().st_size:,} bytes)')


# ══════════════════════════════════════════════════════════════════════════
# 6. Main entrypoint
# ══════════════════════════════════════════════════════════════════════════

def main(dry_run: bool = False) -> None:
    print(f'DhanwantariAI Sync Agent — {TODAY}  (dry_run={dry_run})')
    print('=' * 60)

    bucket     = os.environ.get('S3_BUCKET', 'dhanwantariai-updates')
    cdn_bucket = os.environ.get('CDN_ORIGIN_BUCKET', 'dhanwantariai-cdn-origin')

    # ── Load current published database ───────────────────────────────────
    current_db_path = BASE / 'DhanwantariAI_Symptom_Disease_Mapping_FIXED.json'
    if not current_db_path.exists():
        current_db_path = BASE / 'DhanwantariAI_Symptom_Disease_Mapping (1).json'
    current_db = load_json(current_db_path)
    prev_db_version = current_db.get('metadata', {}).get('version', 'unknown')
    print(f'Current DB version: {prev_db_version}')

    # ── Load current price catalogue ──────────────────────────────────────
    price_path = BASE / 'sync' / 'janaushadhi_prices_current.json'
    if price_path.exists():
        current_prices = load_json(price_path)
    else:
        # First run: extract prices from disease DB
        current_prices = {'_version': prev_db_version}
    prev_price_version = current_prices.get('_version', prev_db_version)

    # ── Step 1: Fetch updates ──────────────────────────────────────────────
    print('\n[1] Checking for price updates...')
    new_prices, price_changes = fetch_latest_prices(current_prices)
    print(f'    Price changes detected: {len(price_changes)}')
    if price_changes:
        print(f'    Changed drugs: {price_changes[:5]}{"..." if len(price_changes) > 5 else ""}')

    print('\n[2] Checking for guideline updates...')
    new_db, guideline_changes = check_guideline_updates(current_db)
    print(f'    Disease record changes: {len(guideline_changes)}')

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # ── Step 2: Build disease DB delta ────────────────────────────────
        print('\n[3] Generating disease DB delta...')
        delta = generate_disease_db_delta(current_db, new_db)
        print(f'    Delta: {delta["replaced"]} replaced, '
              f'{len(delta["added"])} added, {len(delta["removed"])} removed')

        new_db['metadata']['version'] = TODAY

        # Full DB package
        db_full_path  = tmp / f'disease_db_{TODAY}.json'
        db_full_gz    = tmp / f'disease_db_{TODAY}.json.gz'
        save_json(new_db, db_full_path)
        gzip_file(db_full_path, db_full_gz)

        # Delta package (only publish if there are changes)
        db_delta_gz = None
        if delta['total_changes'] > 0:
            db_delta_path = tmp / f'disease_db_delta_{prev_db_version}_to_{TODAY}.json'
            db_delta_gz   = tmp / f'disease_db_delta_{prev_db_version}_to_{TODAY}.json.gz'
            save_json(delta, db_delta_path)
            gzip_file(db_delta_path, db_delta_gz)
            print(f'    Delta size: {db_delta_gz.stat().st_size:,} bytes '
                  f'(full: {db_full_gz.stat().st_size:,} bytes, '
                  f'saving {100 - 100*db_delta_gz.stat().st_size//db_full_gz.stat().st_size}%)')
        else:
            print('    No disease changes — delta not published')

        # ── Step 3: Build price catalogue packages ────────────────────────
        print('\n[4] Packaging price catalogue...')
        new_prices['_version'] = TODAY
        price_full_path = tmp / f'janaushadhi_prices_{TODAY}.json'
        price_full_gz   = tmp / f'janaushadhi_prices_{TODAY}.json.gz'
        save_json(new_prices, price_full_path)
        gzip_file(price_full_path, price_full_gz)

        price_delta_gz = None
        if price_changes:
            price_delta = {
                'from_version': prev_price_version,
                'to_version':   TODAY,
                'changed': {drug: new_prices[drug] for drug in price_changes},
            }
            price_delta_path = tmp / f'prices_delta_{prev_price_version}_to_{TODAY}.json'
            price_delta_gz   = tmp / f'prices_delta_{prev_price_version}_to_{TODAY}.json.gz'
            save_json(price_delta, price_delta_path)
            gzip_file(price_delta_path, price_delta_gz)

        # ── Step 4: Check for model update (manual trigger via flag file) ──
        # pending_model_update.json format:
        # {
        #   "variants": [
        #     {
        #       "id": "gemma3-4b-dhanwantari-ft",
        #       "version": "20260306",
        #       "litert_file": "gemma3-4b-dhanwantari-ft-20260306.bin",
        #       "gguf_file":   "gemma3-4b-dhanwantari-ft-20260306.Q4_K_M.gguf",
        #       "litert_size_bytes": 2684354560,
        #       "gguf_size_bytes":   2684354560,
        #       "litert_sha256": "abc...",
        #       "gguf_sha256":   "def...",
        #       "require_wifi": true,
        #       "changelog": "Fine-tuned on FIXED JSON v20260306"
        #     },
        #     { "id": "gemma3-1b-dhanwantari-ft", ... }
        #   ]
        # }
        print('\n[5] Checking for model weight update...')
        model_flag = BASE / 'sync' / 'pending_model_update.json'
        model_variants_to_publish: list[dict] | None = None
        if model_flag.exists():
            model_info = load_json(model_flag)
            model_variants_to_publish = model_info.get('variants', [])
            for v in model_variants_to_publish:
                mb = v.get('litert_size_bytes', 0) // 1_048_576
                print(f'    New variant pending: {v["id"]} v{v["version"]} ({mb} MB LiteRT)')
        else:
            print('    No new model weights today')

        # ── Step 5: Build manifest ─────────────────────────────────────────
        print('\n[6] Building sync manifest...')
        manifest = build_manifest(
            db_version                = TODAY,
            db_full_gz                = db_full_gz,
            db_delta_gz               = db_delta_gz,
            prev_db_version           = prev_db_version if delta['total_changes'] > 0 else None,
            price_version             = TODAY,
            price_full_gz             = price_full_gz,
            price_delta_gz            = price_delta_gz,
            prev_price_version        = prev_price_version if price_changes else None,
            model_variants_to_publish = model_variants_to_publish,
        )
        manifest_path = tmp / 'sync_manifest.json'
        save_json(manifest, manifest_path)
        print(f'    Manifest: {manifest_path.stat().st_size:,} bytes')

        # ── Step 6: Upload to S3 ───────────────────────────────────────────
        print('\n[7] Uploading to S3...')
        upload_to_s3(db_full_gz,   bucket, f'updates/{db_full_gz.name}',   dry_run)
        if db_delta_gz:
            upload_to_s3(db_delta_gz, bucket, f'updates/{db_delta_gz.name}', dry_run)
        upload_to_s3(price_full_gz, bucket, f'updates/{price_full_gz.name}', dry_run)
        if price_delta_gz:
            upload_to_s3(price_delta_gz, bucket, f'updates/{price_delta_gz.name}', dry_run)

        # Upload model variant files (LiteRT .bin + GGUF for each variant)
        if model_variants_to_publish:
            for v in model_variants_to_publish:
                for file_key in ('litert_file', 'gguf_file'):
                    fname = v.get(file_key, '')
                    if not fname:
                        continue
                    fpath = BASE / 'models' / fname
                    if fpath.exists():
                        upload_to_s3(fpath, bucket, f'models/{fname}', dry_run)
                    else:
                        print(f'  [WARN] Model file not found locally: {fpath}')
                        print(f'         (OK if already uploaded to S3 directly)')

        # Manifest goes to CDN origin (publicly readable, no auth required)
        upload_to_s3(manifest_path, cdn_bucket, 'sync_manifest.json', dry_run)

        # ── Step 7: Save local state for next run ─────────────────────────
        if not dry_run:
            save_json(new_db,     current_db_path)
            save_json(new_prices, price_path)
            if model_variants_to_publish and model_flag.exists():
                model_flag.unlink()
                print('\n    Cleared pending_model_update.json (variants published)')

        print('\n' + '=' * 60)
        print('Agent 1 (Data Sync) complete.')
        print(f'  Disease DB delta changes : {delta["total_changes"]}')
        print(f'  Price changes            : {len(price_changes)}')
        n_variants = len(model_variants_to_publish) if model_variants_to_publish else 0
        print(f'  Model variants published : {n_variants}'
              + (f' ({", ".join(v["id"] for v in model_variants_to_publish)})'
                 if model_variants_to_publish else ''))
        print('\nSee bedrock_inference_agent.py for Agent 2 (Tier 1 device LLM inference).')
        print('See bedrock_kb_agent.py for Agent 3 (RAG knowledge base).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DhanwantariAI Bedrock Sync Agent')
    parser.add_argument('--dry-run', action='store_true', help='Run without uploading to S3')
    args = parser.parse_args()
    main(dry_run=args.dry_run)
