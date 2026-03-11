"""
client_sync_engine.py
---------------------
Reference implementation of the DhanwantariAI client-side sync policy engine.
Language: Python (mirrors 1-to-1 to Dart/Kotlin/Swift — see comments).

Model selection is driven entirely by sync/model_variants.json.
To add a new model tier: edit model_variants.json only — no code changes needed.

This module is NOT run on the cloud. It represents the logic that runs on
the mobile app when it comes online after an offline period.

Usage in tests / simulation:
    python3 sync/client_sync_engine.py --simulate

Dart port:  lib/sync/sync_engine.dart
Kotlin port: app/src/main/java/in/dhanwantariai/sync/SyncEngine.kt
"""

from __future__ import annotations

import json
import hashlib
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional
import argparse

_VARIANTS_CONFIG: Optional[dict] = None

def _load_variants_config() -> dict:
    global _VARIANTS_CONFIG
    if _VARIANTS_CONFIG is None:
        cfg_path = Path(__file__).parent / 'model_variants.json'
        with open(cfg_path, encoding='utf-8') as f:
            _VARIANTS_CONFIG = json.load(f)
    return _VARIANTS_CONFIG


# ══════════════════════════════════════════════════════════════════════════
# Data models  (→ Dart: @freezed classes, Kotlin: data class)
# ══════════════════════════════════════════════════════════════════════════

class SyncAction(str, Enum):
    SKIP              = 'skip'
    APPLY_DELTA       = 'apply_delta'
    DOWNLOAD_FULL     = 'download_full'
    PROMPT_USER       = 'prompt_user'
    NOTIFY_ONLY       = 'notify_only'
    PROMINENT_BANNER  = 'prominent_banner'


@dataclass
class LocalPackageState:
    """What the device currently has installed."""
    version:       str
    last_synced:   datetime        # UTC
    sha256:        str = ''


@dataclass
class ManifestPackage:
    """One entry from sync_manifest.json packages dict."""
    version:          str
    sha256:           str
    size_bytes:       int
    url:              str
    sync_policy:      dict
    delta_url:        Optional[str] = None
    delta_sha256:     Optional[str] = None
    delta_size_bytes: Optional[int] = None
    delta_from_version: Optional[str] = None


@dataclass
class SyncDecision:
    """Output of the policy engine for one package."""
    package:        str
    action:         SyncAction
    use_delta:      bool = False
    needs_wifi:     bool = False
    prompt_message: str  = ''
    reason:         str  = ''


@dataclass
class ModelVariant:
    """One entry from model_variants.json — what the device should download."""
    id:                    str
    display_name:          str
    base_model:            str
    litert_file:           str
    gguf_file:             str
    litert_size_bytes:     int
    gguf_size_bytes:       int
    min_ram_mb:            int
    require_wifi:          bool
    capabilities:          list[str]
    version:               str = ''
    litert_sha256:         str = ''
    gguf_sha256:           str = ''


def select_model_variant(
    device_ram_mb: int,
    is_on_wifi:    bool,
    variants_cfg:  Optional[dict] = None,
) -> Optional[ModelVariant]:
    """
    Pick the best model variant for this device based on model_variants.json.

    Strategy: "highest_fitting_variant"
      - Walk variants in order (highest to lowest capability)
      - Return the first one whose min_ram_mb <= device_ram_mb
        and whose require_wifi_to_download is satisfied

    Returns None if the device falls below the rule-engine threshold
    (i.e., no model should ever be downloaded).

    Dart equivalent:
      ModelVariant? selectVariant(int ramMb, bool onWifi) { ... }
    """
    cfg = variants_cfg or _load_variants_config()
    fallback_threshold = cfg['selection_policy']['fallback_to_rule_engine_below_mb']

    if device_ram_mb < fallback_threshold:
        return None  # rule-engine only tier

    for raw in cfg['variants']:
        ram_ok  = device_ram_mb >= raw['min_ram_mb']
        wifi_ok = (not raw['require_wifi_to_download']) or is_on_wifi
        if ram_ok and wifi_ok:
            return ModelVariant(
                id                = raw['id'],
                display_name      = raw['display_name'],
                base_model        = raw['base_model'],
                litert_file       = raw['litert_file'],
                gguf_file         = raw['gguf_file'],
                litert_size_bytes = raw['litert_size_bytes'],
                gguf_size_bytes   = raw['gguf_size_bytes'],
                min_ram_mb        = raw['min_ram_mb'],
                require_wifi      = raw['require_wifi_to_download'],
                capabilities      = raw['capabilities'],
                version           = raw.get('version', ''),
                litert_sha256     = raw.get('litert_sha256', ''),
                gguf_sha256       = raw.get('gguf_sha256', ''),
            )

    # All variants need WiFi and device isn't on WiFi — return first RAM-fitting
    # variant without the wifi constraint so the UI can show a "connect to WiFi" prompt
    for raw in cfg['variants']:
        if device_ram_mb >= raw['min_ram_mb']:
            return ModelVariant(
                id                = raw['id'],
                display_name      = raw['display_name'],
                base_model        = raw['base_model'],
                litert_file       = raw['litert_file'],
                gguf_file         = raw['gguf_file'],
                litert_size_bytes = raw['litert_size_bytes'],
                gguf_size_bytes   = raw['gguf_size_bytes'],
                min_ram_mb        = raw['min_ram_mb'],
                require_wifi      = raw['require_wifi_to_download'],
                capabilities      = raw['capabilities'],
                version           = raw.get('version', ''),
            )

    return None  # device RAM too low for any variant


@dataclass
class SessionRecord:
    """
    A completed diagnostic session — IMMUTABLE after creation.
    Version tags are written at session-close time and never updated.

    Rule: sync operations MUST NOT modify any SessionRecord field.
    Historical prices shown in a past session stay as they were.
    """
    session_id:              str
    disease_id:              str
    created_at:              datetime
    disease_db_version:      str     # snapshot of DB version used
    price_catalog_version:   str     # snapshot of prices used (immutable)
    model_variant_id:        str     # e.g. 'gemma3-4b-dhanwantari-ft' or 'rule-engine'
    model_weights_version:   str     # snapshot of model used
    symptoms_input:          list[str] = field(default_factory=list)
    diagnosis_result:        dict     = field(default_factory=dict)
    recommended_medicines:   list[dict] = field(default_factory=dict)  # prices frozen


# ══════════════════════════════════════════════════════════════════════════
# Policy engine
# ══════════════════════════════════════════════════════════════════════════

class SyncPolicyEngine:
    """
    Decides what to do for each package based on:
      - offline_days:    how long since the device last synced
      - local_state:     what version is currently installed
      - manifest_pkg:    what the server says is available
      - device_ram_mb:   drives select_model_variant() — config-driven, not hardcoded
      - is_on_wifi:      for wifi-only packages

    Model tier is resolved via select_model_variant() which reads model_variants.json.
    Adding a new model tier = edit model_variants.json, zero code changes here.
    """

    OFFLINE_TIER_RULES = {
        # (min_days, max_days): {package: action_key}
        (0, 7):   {'disease_db': 'delta',   'price_catalog': 'delta',  'model_weights': 'notify'},
        (8, 30):  {'disease_db': 'delta',   'price_catalog': 'full',   'model_weights': 'notify'},
        (31, 90): {'disease_db': 'full',    'price_catalog': 'full',   'model_weights': 'notify_staleness'},
        (91, 9999): {'disease_db': 'full',  'price_catalog': 'full',   'model_weights': 'banner'},
    }

    def __init__(
        self,
        local_states:   dict[str, LocalPackageState],
        manifest:       dict,
        device_ram_mb:  int  = 4096,   # MB, not GB — avoids float precision issues
        is_on_wifi:     bool = True,
        now:            Optional[datetime] = None,
        variants_cfg:   Optional[dict] = None,  # inject in tests; None = load from file
    ):
        self.local_states   = local_states
        self.manifest       = manifest
        self.device_ram_mb  = device_ram_mb
        self.is_on_wifi     = is_on_wifi
        self.now            = now or datetime.now(timezone.utc)
        self._variants_cfg  = variants_cfg or _load_variants_config()
        # Resolve the target variant once at init — used by _decide_model_weights
        self._target_variant: Optional[ModelVariant] = select_model_variant(
            device_ram_mb, is_on_wifi, self._variants_cfg
        )

    def _offline_days(self, package: str) -> int:
        state = self.local_states.get(package)
        if state is None:
            return 9999   # never synced
        delta_days = (self.now - state.last_synced).days
        return max(0, delta_days)

    def _tier_action(self, package: str, offline_days: int) -> str:
        for (lo, hi), rules in self.OFFLINE_TIER_RULES.items():
            if lo <= offline_days <= hi:
                return rules.get(package, 'full')
        return 'full'

    def _parse_package(self, key: str) -> Optional[ManifestPackage]:
        raw = self.manifest.get('packages', {}).get(key)
        if not raw:
            return None
        return ManifestPackage(
            version             = raw['version'],
            sha256              = raw['sha256'],
            size_bytes          = raw['size_bytes'],
            url                 = raw['url'],
            sync_policy         = raw['sync_policy'],
            delta_url           = raw.get('delta_url'),
            delta_sha256        = raw.get('delta_sha256'),
            delta_size_bytes    = raw.get('delta_size_bytes'),
            delta_from_version  = raw.get('delta_from_version'),
        )

    @property
    def target_variant(self) -> Optional[ModelVariant]:
        """The model variant this device should use. None = rule-engine tier."""
        return self._target_variant

    def decide(self) -> list[SyncDecision]:
        decisions: list[SyncDecision] = []

        # ── disease_db ─────────────────────────────────────────────────────
        d = self._decide_disease_db()
        if d:
            decisions.append(d)

        # ── price_catalog ──────────────────────────────────────────────────
        p = self._decide_price_catalog()
        if p:
            decisions.append(p)

        # ── model_weights — one decision per variant in manifest ───────────
        for m in self._decide_model_weights():
            decisions.append(m)

        return decisions

    # ── disease_db ─────────────────────────────────────────────────────────

    def _decide_disease_db(self) -> Optional[SyncDecision]:
        pkg = self._parse_package('disease_db')
        if not pkg:
            return None

        local = self.local_states.get('disease_db')
        if local and local.version == pkg.version:
            return SyncDecision('disease_db', SyncAction.SKIP, reason='Already up to date')

        offline_days = self._offline_days('disease_db')
        tier_action  = self._tier_action('disease_db', offline_days)

        # Can we use delta?
        can_delta = (
            tier_action == 'delta'
            and pkg.delta_url is not None
            and local is not None
            and local.version == pkg.delta_from_version
        )

        action    = SyncAction.APPLY_DELTA if can_delta else SyncAction.DOWNLOAD_FULL
        use_delta = can_delta

        reason = (
            f'Offline {offline_days}d. '
            + ('Delta available and chain valid.' if use_delta else
               'Full download required (chain broken or first sync).')
        )
        return SyncDecision('disease_db', action, use_delta=use_delta,
                            needs_wifi=False, reason=reason)

    # ── price_catalog ──────────────────────────────────────────────────────

    def _decide_price_catalog(self) -> Optional[SyncDecision]:
        pkg = self._parse_package('price_catalog')
        if not pkg:
            return None

        local = self.local_states.get('price_catalog')
        if local and local.version == pkg.version:
            return SyncDecision('price_catalog', SyncAction.SKIP, reason='Already up to date')

        offline_days = self._offline_days('price_catalog')
        tier_action  = self._tier_action('price_catalog', offline_days)

        can_delta = (
            tier_action == 'delta'
            and pkg.delta_url is not None
            and local is not None
            and local.version == pkg.delta_from_version
        )

        action    = SyncAction.APPLY_DELTA if can_delta else SyncAction.DOWNLOAD_FULL
        use_delta = can_delta

        # CRITICAL: historical sessions never updated — log this explicitly
        reason = (
            f'Offline {offline_days}d. '
            + ('Delta.' if use_delta else 'Full.') +
            ' Historical session prices are IMMUTABLE — only new sessions use these prices.'
        )
        return SyncDecision('price_catalog', action, use_delta=use_delta,
                            needs_wifi=False, reason=reason)

    # ── model_weights — config-driven, one decision per variant ──────────

    def _decide_model_weights(self) -> list[SyncDecision]:
        """
        Model weights policy — driven entirely by model_variants.json.

        - Rule-engine tier (RAM below fallback threshold) → skip all variants
        - For each variant published in the manifest:
            - If this device's target variant matches → evaluate download / prompt
            - Other variants → skip (don't download models the device won't use)
        - Offline staleness warnings applied per offline-tier rules

        Returns a list (usually 0-1 items) of SyncDecisions.
        """
        if self._target_variant is None:
            cfg = self._variants_cfg
            threshold = cfg['selection_policy']['fallback_to_rule_engine_below_mb']
            return [SyncDecision(
                'model_weights', SyncAction.SKIP,
                reason=f'Device RAM {self.device_ram_mb}MB < {threshold}MB threshold — '
                       'rule-engine tier, no model download.'
            )]

        variant    = self._target_variant
        pkg_key    = f'model_weights_{variant.id}'   # e.g. model_weights_gemma3-4b-dhanwantari-ft
        # Fallback: check legacy 'model_weights' key for single-variant manifests
        pkg = self._parse_package(pkg_key) or self._parse_package('model_weights')
        if not pkg:
            return []

        local        = self.local_states.get(pkg_key) or self.local_states.get('model_weights')
        offline_days = self._offline_days(pkg_key)
        tier_action  = self._tier_action('model_weights', offline_days)

        if local and local.version == pkg.version:
            if tier_action == 'banner':
                return [SyncDecision(
                    pkg_key, SyncAction.PROMINENT_BANNER,
                    reason=f'{variant.display_name} is current but device offline '
                           f'{offline_days}d. Warn user to sync DB and prices.'
                )]
            return [SyncDecision(pkg_key, SyncAction.SKIP,
                                 reason=f'{variant.display_name} up to date')]

        # New version available — build user-facing prompt
        size_mb = variant.litert_size_bytes // 1_048_576
        prompt  = (
            f'A better version of {variant.display_name} is available — '
            f'download on Wi-Fi? ({size_mb} MB)'
        )
        if tier_action in ('notify_staleness', 'banner'):
            prompt += (
                f'\n\nYour model has not been updated in {offline_days} days. '
                'Recommendations may be based on outdated protocols.'
            )

        # WiFi requirement comes from model_variants.json, not hardcoded
        needs_wifi = variant.require_wifi
        if needs_wifi and not self.is_on_wifi:
            return [SyncDecision(
                pkg_key, SyncAction.NOTIFY_ONLY,
                needs_wifi=True,
                prompt_message=f'Connect to Wi-Fi to download {variant.display_name} ({size_mb} MB).',
                reason=f'{variant.display_name} update available but not on Wi-Fi.'
            )]

        final_action = (
            SyncAction.PROMINENT_BANNER if tier_action == 'banner'
            else SyncAction.PROMPT_USER
        )
        return [SyncDecision(
            pkg_key, final_action,
            needs_wifi=needs_wifi,
            prompt_message=prompt,
            reason=f'{variant.display_name} v{pkg.version} available. '
                   f'Offline {offline_days}d. RAM {self.device_ram_mb}MB.'
        )]


# ══════════════════════════════════════════════════════════════════════════
# Session record guard
# ══════════════════════════════════════════════════════════════════════════

def assert_session_immutability(session: SessionRecord, proposed_update: dict) -> None:
    """
    Call before any database write operation that touches session records.
    Raises ValueError if the operation would modify version-tagged fields.

    Price updates MUST NOT retroactively change recommended_medicines prices
    stored in past sessions. This function enforces that invariant.
    """
    IMMUTABLE_FIELDS = {
        'disease_db_version', 'price_catalog_version',
        'model_variant_id', 'model_weights_version',
        'recommended_medicines',  # prices are frozen at session-close time
        'diagnosis_result',
        'created_at',
        'session_id',
    }
    violations = IMMUTABLE_FIELDS.intersection(proposed_update.keys())
    if violations:
        raise ValueError(
            f'Sync operation attempted to modify immutable session fields: {violations}. '
            f'Session {session.session_id} is read-only after creation. '
            f'Historical prices must not be retroactively updated.'
        )


# ══════════════════════════════════════════════════════════════════════════
# CLI simulation
# ══════════════════════════════════════════════════════════════════════════

def run_simulation() -> None:
    print('DhanwantariAI Client Sync Engine — Simulation')
    print('=' * 60)

    # Shared manifest — includes both model weight variants
    manifest = {
        'packages': {
            'disease_db': {
                'version': '20260306', 'sha256': 'abc', 'size_bytes': 2_400_000,
                'url': 'https://cdn.dhanwantariai.in/updates/disease_db_20260306.json.gz',
                'sync_policy': {},
            },
            'price_catalog': {
                'version': '20260306', 'sha256': 'def', 'size_bytes': 120_000,
                'url': 'https://cdn.dhanwantariai.in/updates/janaushadhi_prices_20260306.json.gz',
                'sync_policy': {'preserve_historical_sessions': True},
            },
            # 4B variant (≥3000MB RAM, Wi-Fi required)
            'model_weights_gemma3-4b-dhanwantari-ft': {
                'version': '20260306', 'sha256': 'sha_4b', 'size_bytes': 2_684_354_560,
                'url': 'https://cdn.dhanwantariai.in/models/gemma3-4b-dhanwantari-ft.bin',
                'sync_policy': {'auto_update': False, 'prompt_user': True, 'wifi_only': True},
            },
            # 1B variant (≥1500MB RAM, WiFi not required)
            'model_weights_gemma3-1b-dhanwantari-ft': {
                'version': '20260306', 'sha256': 'sha_1b', 'size_bytes': 554_696_704,
                'url': 'https://cdn.dhanwantariai.in/models/gemma3-1b-dhanwantari-ft.bin',
                'sync_policy': {'auto_update': False, 'prompt_user': True, 'wifi_only': False},
            },
        }
    }

    # ── Scenario 1: 4GB RAM, Wi-Fi → should select 4B variant ────────────
    print('\n--- Scenario 1: First sync, 4096MB RAM, Wi-Fi ---')
    engine = SyncPolicyEngine({}, manifest, device_ram_mb=4096, is_on_wifi=True)
    print(f'  Selected variant : {engine.target_variant.id if engine.target_variant else "rule-engine"}')
    for d in engine.decide():
        print(f'  {d.package:50s} → {d.action.value:20s}  wifi={d.needs_wifi}')
        print(f'    {d.reason}')
        if d.prompt_message:
            print(f'    Prompt: "{d.prompt_message[:80]}"')

    # ── Scenario 2: 2GB RAM, Wi-Fi → should select 1B variant ────────────
    print('\n--- Scenario 2: First sync, 2048MB RAM, Wi-Fi ---')
    engine2 = SyncPolicyEngine({}, manifest, device_ram_mb=2048, is_on_wifi=True)
    print(f'  Selected variant : {engine2.target_variant.id if engine2.target_variant else "rule-engine"}')
    for d in engine2.decide():
        print(f'  {d.package:50s} → {d.action.value:20s}')
        print(f'    {d.reason}')

    # ── Scenario 3: 4GB RAM, mobile data → 4B needs WiFi, falls back to 1B
    print('\n--- Scenario 3: 4096MB RAM, mobile data ---')
    engine3 = SyncPolicyEngine({}, manifest, device_ram_mb=4096, is_on_wifi=False)
    print(f'  Selected variant : {engine3.target_variant.id if engine3.target_variant else "rule-engine"}')
    for d in engine3.decide():
        print(f'  {d.package:50s} → {d.action.value:20s}')
        print(f'    {d.reason}')

    # ── Scenario 4: 1GB RAM → rule-engine tier, no model at all ──────────
    print('\n--- Scenario 4: 1024MB RAM, mobile data ---')
    engine4 = SyncPolicyEngine({}, manifest, device_ram_mb=1024, is_on_wifi=False)
    print(f'  Selected variant : {engine4.target_variant.id if engine4.target_variant else "rule-engine"}')
    for d in engine4.decide():
        print(f'  {d.package:50s} → {d.action.value:20s}')
        print(f'    {d.reason}')

    # ── Scenario 5: 45 days offline, 4GB RAM, Wi-Fi ───────────────────────
    print('\n--- Scenario 5: 45 days offline, 4096MB RAM, Wi-Fi ---')
    old_ts = datetime.now(timezone.utc) - timedelta(days=45)
    local = {
        'disease_db':    LocalPackageState('20260120', old_ts),
        'price_catalog': LocalPackageState('20260120', old_ts),
        'model_weights_gemma3-4b-dhanwantari-ft': LocalPackageState('20260115', old_ts),
    }
    engine5 = SyncPolicyEngine(local, manifest, device_ram_mb=4096, is_on_wifi=True)
    print(f'  Selected variant : {engine5.target_variant.id if engine5.target_variant else "rule-engine"}')
    for d in engine5.decide():
        print(f'  {d.package:50s} → {d.action.value:20s}')
        print(f'    {d.reason}')

    # ── Scenario 6: Session immutability guard ────────────────────────────
    print('\n--- Scenario 6: Session immutability guard ---')
    session = SessionRecord(
        session_id='sess_001', disease_id='hypertension',
        created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
        disease_db_version='20260120',
        price_catalog_version='20260120',
        model_variant_id='gemma3-4b-dhanwantari-ft',
        model_weights_version='20260115',
        symptoms_input=['headache', 'dizziness'],
        diagnosis_result={'disease': 'Hypertension', 'confidence': 0.87},
        recommended_medicines=[{'name': 'Amlodipine 5mg', 'mrp_at_session': 32.0}],
    )
    try:
        assert_session_immutability(session, {'price_catalog_version': '20260306'})
    except ValueError as e:
        print(f'  BLOCKED (correct): {str(e)[:100]}')
    try:
        assert_session_immutability(session, {'model_variant_id': 'gemma3-1b-dhanwantari-ft'})
    except ValueError as e:
        print(f'  BLOCKED (correct): {str(e)[:100]}')

    print('\nSimulation complete.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--simulate', action='store_true')
    args = parser.parse_args()
    if args.simulate:
        run_simulation()
    else:
        print('Run with --simulate to see policy engine decisions.')
        print('Import SyncPolicyEngine into your app to use it directly.')
