/**
 * DeviceCapabilityDetector.ts
 *
 * Detects device tier at first launch and caches it permanently.
 * v2.2: 5-signal detection per Architecture §4.2.
 *
 * Tier 1 — RAM < 2 GB, isLowRam, no ARM64, or API < 26
 *           → PageIndex + Rule Engine only
 * Tier 2 — RAM 2–8 GB, ARM64, API ≥ 26
 *           → Optional Gemma 3 1B int4 (529 MB)
 * Tier 3 — RAM ≥ 8 GB, ARM64, API ≥ 26
 *           → Optional Gemma 3 4B int4 (~2.5 GB)
 *
 * 5 signals: RAM, freeDisk, isLowRam, apiLevel, cpuArch (arm64/arm32/x86_64)
 * nnApiSupported = apiLevel ≥ 27 && cpuArch === 'arm64'
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import type {CpuArch, DeviceProfile, DeviceTier} from '@store/types';

// v2: profile schema extended with cpuArch + nnApiSupported — bump key to invalidate v1 cache
const TIER_CACHE_KEY = 'dhanwantari_device_profile_v2';

/**
 * Resolve CPU architecture from the ABI list returned by getSupportedAbis().
 */
function resolveCpuArch(abis: string[]): CpuArch {
  if (abis.some(a => a.includes('arm64') || a === 'arm64-v8a')) return 'arm64';
  if (abis.some(a => a.startsWith('arm'))) return 'arm32';
  return 'x86_64';
}

/**
 * Detect device capability and assign a tier.
 * Result is cached in AsyncStorage — tier never changes on a given device.
 */
export async function detectDeviceCapability(): Promise<DeviceProfile> {
  // Return cached profile — tier never changes on a given device
  try {
    const cached = await AsyncStorage.getItem(TIER_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as DeviceProfile;
    }
  } catch {
    // Cache miss or corrupt — proceed with fresh detection
  }

  const [totalRAM, freeDisk, isLowRam, model, apiLevel, supportedAbis] =
    await Promise.all([
      DeviceInfo.getTotalMemory(),      // physical RAM in bytes
      DeviceInfo.getFreeDiskStorage(),  // available storage in bytes
      DeviceInfo.isLowRamDevice(),      // Android system low-RAM flag
      DeviceInfo.getModel(),            // e.g. "Redmi Note 10"
      DeviceInfo.getApiLevel(),         // Android API level (NNAPI at 27+)
      DeviceInfo.supportedAbis(),       // e.g. ['arm64-v8a', 'armeabi-v7a']
    ]);

  const ramGB = totalRAM / 1_073_741_824; // bytes → GB
  const freeDiskGB = freeDisk / 1_073_741_824;

  // Signal 4: CPU architecture
  const cpuArch = resolveCpuArch(supportedAbis);
  const isArm64 = cpuArch === 'arm64';

  // Signal 5: NNAPI availability (API ≥ 27 with ARM64)
  const nnApiSupported = apiLevel >= 27 && isArm64;

  let tier: DeviceTier;
  let llmModelSuggested: string | null = null;

  // Hard force to Tier 1 if device lacks ARM64 or is on old Android (< 26)
  // These devices cannot run quantised LLMs reliably.
  const forceTier1 = !isArm64 || apiLevel < 26 || isLowRam || ramGB < 2;

  if (forceTier1) {
    tier = 'TIER_1';
    llmModelSuggested = null;
  } else if (ramGB < 8) {
    tier = 'TIER_2';
    llmModelSuggested = freeDiskGB > 3 ? 'gemma3-1b-int4' : null;
  } else {
    tier = 'TIER_3';
    llmModelSuggested =
      freeDiskGB > 5 ? 'gemma3-4b-int4' : 'gemma3-1b-int4';
  }

  const profile: DeviceProfile = {
    tier,
    ramGB: parseFloat(ramGB.toFixed(2)),
    freeDiskGB: parseFloat(freeDiskGB.toFixed(2)),
    isLowRam,
    model,
    apiLevel,
    cpuArch,
    nnApiSupported,
    llmEligible: tier !== 'TIER_1',
    llmModelSuggested,
  };

  // Persist so we never re-detect on the same device
  try {
    await AsyncStorage.setItem(TIER_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures — in-memory result is still used
  }

  return profile;
}

/**
 * Clear the cached tier — useful for testing / debug builds.
 */
export async function clearDeviceTierCache(): Promise<void> {
  await AsyncStorage.removeItem(TIER_CACHE_KEY);
}

/** Human-readable label for a tier */
export function tierLabel(tier: DeviceTier): string {
  switch (tier) {
    case 'TIER_1': return 'T1';
    case 'TIER_2': return 'T2';
    case 'TIER_3': return 'T3';
  }
}

/** LLM download size hint for the opt-in prompt */
export function llmDownloadSizeLabel(model: string | null): string {
  if (!model) return '';
  if (model.includes('4b')) return '~2.5 GB';
  return '~529 MB';
}
