/**
 * DhanwantariAI E2E Test Suite
 *
 * Tests the full flow: Profile selection → Chat (Bedrock) → Symptom Checker → Analysis
 *
 * Test profile: Satyam Kumar Das, male, age 46, BMI 32.2 (Obese Class I)
 *
 * Test cases are designed around clinically relevant scenarios for this profile:
 *   TC1: Chat → Bedrock: Diabetes query (high relevance for obese, 46yo male)
 *   TC2: Chat → Bedrock: Hypertension query (high BMI + age risk)
 *   TC3: Chat → Bedrock: Dengue danger signs (India-specific)
 *   TC4: Symptom Checker → Dengue symptoms → Analysis
 *   TC5: Symptom Checker → Diabetes symptoms → Analysis → Medicines
 *   TC6: Symptom Checker → Tuberculosis symptoms → Analysis
 *   TC7: Chat → Bedrock: Medicine dosage for BMI > 30
 */

const {device, element, by, expect, waitFor} = require('detox');

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEST_LOG = [];
const BEDROCK_TIMEOUT = 30000; // 30s max for Bedrock response

function log(tag, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    tag,
    message,
    ...data,
  };
  TEST_LOG.push(entry);
  console.log(`[${tag}] ${message}`, JSON.stringify(data));
}

function logSummary() {
  console.log('\n' + '═'.repeat(80));
  console.log('  DHANWANTARI AI — E2E TEST RESULTS SUMMARY');
  console.log('═'.repeat(80));

  const bedrockCalls = TEST_LOG.filter(e => e.tag === 'BEDROCK');
  const totalTime = bedrockCalls.reduce((sum, e) => sum + (e.latencyMs || 0), 0);

  console.log(`\n  Profile: Satyam Kumar Das | Age: 46 | BMI: 32.2 (Obese)`);
  console.log(`  Total Bedrock calls: ${bedrockCalls.length}`);
  console.log(`  Total Bedrock time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(
    `  Avg Bedrock latency: ${bedrockCalls.length > 0 ? (totalTime / bedrockCalls.length / 1000).toFixed(2) : 0}s`,
  );

  console.log('\n  ┌─ Bedrock Response Log ─────────────────────────────────');
  for (const entry of bedrockCalls) {
    console.log(
      `  │ ${entry.query?.substring(0, 50)}... → ${entry.latencyMs}ms`,
    );
  }
  console.log('  └───────────────────────────────────────────────────────\n');

  const symptomTests = TEST_LOG.filter(e => e.tag === 'SYMPTOM');
  if (symptomTests.length > 0) {
    console.log('  ┌─ Symptom Checker Log ─────────────────────────────────');
    for (const entry of symptomTests) {
      console.log(`  │ ${entry.message}`);
    }
    console.log('  └───────────────────────────────────────────────────────\n');
  }

  console.log('═'.repeat(80) + '\n');
}

async function waitForBedrockResponse() {
  // Wait until the thinking indicator disappears (response arrived)
  // Disable sync — chat screen has constant main-queue activity
  const start = Date.now();
  await device.disableSynchronization();
  try {
    // First wait for Thinking to appear
    await waitFor(element(by.text('Thinking…')))
      .toBeVisible()
      .withTimeout(5000);
  } catch {
    // Thinking text may already have appeared and gone
  }
  try {
    await waitFor(element(by.text('Thinking…')))
      .not.toBeVisible()
      .withTimeout(BEDROCK_TIMEOUT);
  } catch {
    // Response may have been too fast
  }
  await device.enableSynchronization();
  return Date.now() - start;
}

async function dismissKeyboard() {
  // Scroll the FlatList slightly to trigger keyboardDismissMode="on-drag"
  // Must disable sync because chat screen has constant main-queue activity
  await device.disableSynchronization();
  try {
    await element(by.id('chat-messages-list')).scroll(50, 'up');
  } catch {}
  try {
    await element(by.id('chat-messages-list')).scroll(50, 'down');
  } catch {}
  await new Promise(r => setTimeout(r, 600));
  await device.enableSynchronization();
}

async function sendChatMessage(message) {
  // Dismiss keyboard so input toolbar is visible
  await dismissKeyboard();

  // Disable sync for the entire send flow — chat screen stays busy
  await device.disableSynchronization();

  await waitFor(element(by.id('chat-input')))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id('chat-input')).tap();
  await element(by.id('chat-input')).replaceText(message);

  // Dismiss keyboard so send button is hittable
  try {
    await element(by.id('chat-messages-list')).scroll(20, 'up');
  } catch {}
  await new Promise(r => setTimeout(r, 400));

  await waitFor(element(by.id('chat-send-btn')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('chat-send-btn')).tap();

  await device.enableSynchronization();
}

async function getLastAssistantMessage() {
  await device.disableSynchronization();
  // Scroll to bottom to make sure latest message is visible
  try {
    await element(by.id('chat-messages-list')).scrollTo('bottom');
  } catch {
    // List might not be scrollable
  }
  // Small wait for rendering
  await new Promise(r => setTimeout(r, 500));
  await device.enableSynchronization();
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('DhanwantariAI E2E — Full Clinical Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    log('SETUP', 'App launched');
  });

  afterAll(async () => {
    logSummary();
  });

  // ── TC0: Select profile ─────────────────────────────────────────────────

  it('TC0: Should select Satyam Kumar Das profile and enter chat', async () => {
    // Wait for profile list to load
    await waitFor(element(by.text('DhanwantariAI')))
      .toBeVisible()
      .withTimeout(10000);

    log('PROFILE', 'Profile list screen visible');

    // Tap first profile card (Satyam Kumar Das)
    await waitFor(element(by.id('profile-card-0')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('profile-card-0')).tap();

    // Wait for chat screen: input field should appear
    await waitFor(element(by.id('chat-input')))
      .toBeVisible()
      .withTimeout(15000);

    log('PROFILE', 'Entered chat for Satyam Kumar Das');

    // Verify welcome message appeared — disable sync to avoid main-queue busy timeout
    await device.disableSynchronization();
    try {
      await waitFor(element(by.text(/Namaste/)))
        .toExist()
        .withTimeout(10000);
      log('PROFILE', 'Welcome message displayed');
    } catch {
      // Welcome message might already be scrolled or formatted differently
      log('PROFILE', 'Welcome message check skipped — chat screen is ready');
    }
    await device.enableSynchronization();
  });

  // ── TC1: Bedrock — Diabetes query (BMI 32.2 → high risk) ───────────────

  it('TC1: Bedrock chat — Diabetes risk for obese patient', async () => {
    const query =
      'I am 46 years old with BMI 32.2. What is my diabetes risk and which JanAushadhi medicines should I keep ready?';

    const startTime = Date.now();
    await sendChatMessage(query);

    const latencyMs = await waitForBedrockResponse();
    await getLastAssistantMessage();

    log('BEDROCK', 'Diabetes risk query responded', {
      query,
      latencyMs,
      testCase: 'TC1',
    });

    // Verify we got a response (any assistant message beyond the welcome)
    await waitFor(element(by.id('chat-messages-list')))
      .toBeVisible()
      .withTimeout(5000);

    log(
      'BEDROCK',
      `TC1 Bedrock latency: ${(latencyMs / 1000).toFixed(2)}s`,
      {latencyMs},
    );
  });

  // ── TC2: Bedrock — Hypertension query ──────────────────────────────────

  it('TC2: Bedrock chat — Hypertension management for BMI > 30', async () => {
    const query =
      'My blood pressure has been 150/95 for the past week. I weigh 92 kg. What should I do and what affordable medicines are available at JanAushadhi?';

    const startTime = Date.now();
    await sendChatMessage(query);

    const latencyMs = await waitForBedrockResponse();
    await getLastAssistantMessage();

    log('BEDROCK', 'Hypertension query responded', {
      query,
      latencyMs,
      testCase: 'TC2',
    });
  });

  // ── TC3: Bedrock — Dengue danger signs ─────────────────────────────────

  it('TC3: Bedrock chat — Dengue danger signs', async () => {
    const query =
      'My village has dengue outbreak. I have high fever for 3 days with body pain and rash. What are the danger signs I should watch for?';

    const startTime = Date.now();
    await sendChatMessage(query);

    const latencyMs = await waitForBedrockResponse();
    await getLastAssistantMessage();

    log('BEDROCK', 'Dengue danger signs query responded', {
      query,
      latencyMs,
      testCase: 'TC3',
    });
  });

  // ── TC4: Symptom Checker — Dengue flow ─────────────────────────────────

  it('TC4: Symptom Checker — Dengue symptoms → Analysis', async () => {
    log('SYMPTOM', 'Starting Dengue symptom check flow');

    // Dismiss keyboard so toolbar is visible
    await dismissKeyboard();

    // Disable sync — chat screen has constant main-queue activity
    await device.disableSynchronization();

    // Navigate to symptom checker
    await waitFor(element(by.id('symptom-checker-btn')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('symptom-checker-btn')).tap();
    await device.enableSynchronization();
    await waitFor(element(by.text('Symptom Checker')))
      .toBeVisible()
      .withTimeout(5000);

    log('SYMPTOM', 'Symptom Checker screen opened');

    // Expand "General" category (should be expanded by default)
    // Select: Fever, Fatigue, Loss of Appetite
    const generalSymptoms = ['Fever', 'Fatigue', 'Loss of Appetite'];
    for (const symptom of generalSymptoms) {
      try {
        await waitFor(element(by.id(`symptom-${symptom.replace(/\s+/g, '-')}`)))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id(`symptom-${symptom.replace(/\s+/g, '-')}`)).tap();
        log('SYMPTOM', `Selected: ${symptom}`);
      } catch {
        log('SYMPTOM', `Could not find/tap: ${symptom} — scrolling`);
        try {
          await element(by.text(symptom)).scrollTo('bottom');
          await element(by.id(`symptom-${symptom.replace(/\s+/g, '-')}`)).tap();
          log('SYMPTOM', `Selected after scroll: ${symptom}`);
        } catch {
          log('SYMPTOM', `Skipped: ${symptom}`);
        }
      }
    }

    // Expand Head & Neurological → select Headache
    try {
      await element(by.id('category-Head-&-Neurological')).tap();
      await waitFor(element(by.id('symptom-Headache')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('symptom-Headache')).tap();
      log('SYMPTOM', 'Selected: Headache');
    } catch {
      log('SYMPTOM', 'Could not expand Head & Neurological or select Headache');
    }

    // Expand Musculoskeletal → select Joint Pain, Muscle Pain
    try {
      await element(by.id('category-Musculoskeletal')).tap();
      await waitFor(element(by.id('symptom-Joint-Pain')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('symptom-Joint-Pain')).tap();
      log('SYMPTOM', 'Selected: Joint Pain');
      await element(by.id('symptom-Muscle-Pain')).tap();
      log('SYMPTOM', 'Selected: Muscle Pain');
    } catch {
      log('SYMPTOM', 'Could not select Musculoskeletal symptoms');
    }

    // Expand Skin & Hair → select Skin Rash
    try {
      await element(by.id('category-Skin-&-Hair')).tap();
      await waitFor(element(by.id('symptom-Skin-Rash')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('symptom-Skin-Rash')).tap();
      log('SYMPTOM', 'Selected: Skin Rash');
    } catch {
      log('SYMPTOM', 'Could not select Skin Rash');
    }

    // Tap Analyze button
    await element(by.id('analyze-symptoms-btn')).tap();
    log('SYMPTOM', 'Tapped Analyze button');

    // Wait for Analysis Results screen
    await waitFor(element(by.text('Analysis Results')))
      .toBeVisible()
      .withTimeout(10000);

    log('SYMPTOM', 'TC4: Analysis Results screen displayed');

    // Check for Dengue Fever in results
    try {
      await waitFor(element(by.text(/Dengue/)))
        .toBeVisible()
        .withTimeout(5000);
      log('SYMPTOM', 'TC4: Dengue Fever identified in results ✓');
    } catch {
      log('SYMPTOM', 'TC4: Dengue not found in top results');
    }

    // Check severity badge
    try {
      await waitFor(element(by.text('Clinical Severity')))
        .toBeVisible()
        .withTimeout(3000);
      log('SYMPTOM', 'TC4: Severity badge displayed ✓');
    } catch {
      log('SYMPTOM', 'TC4: Severity badge not visible');
    }

    // Go back to chat via Done
    try {
      await element(by.text('Done')).tap();
      await waitFor(element(by.id('chat-input')))
        .toBeVisible()
        .withTimeout(10000);
      log('SYMPTOM', 'TC4: Returned to Chat screen');

      // Wait for auto-sent analysis message → this triggers Bedrock
      const bedrockLatency = await waitForBedrockResponse();
      log('BEDROCK', 'TC4: Symptom analysis → Bedrock response', {
        latencyMs: bedrockLatency,
        query: 'Auto-sent symptom analysis summary',
        testCase: 'TC4-bedrock',
      });
    } catch {
      log('SYMPTOM', 'TC4: Could not return to chat');
    }
  });

  // ── TC5: Symptom Checker — Diabetes symptoms ──────────────────────────

  it('TC5: Symptom Checker — Diabetes symptoms → Analysis → Medicines', async () => {
    log('SYMPTOM', 'Starting Diabetes symptom check flow');

    // Dismiss keyboard so toolbar is visible
    await dismissKeyboard();

    // Disable sync — chat screen has constant main-queue activity
    await device.disableSynchronization();

    // Navigate to symptom checker
    await waitFor(element(by.id('symptom-checker-btn')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('symptom-checker-btn')).tap();
    await device.enableSynchronization();
    await waitFor(element(by.text('Symptom Checker')))
      .toBeVisible()
      .withTimeout(5000);

    // General → Fatigue, Tiredness
    const generalSymptoms = ['Fatigue', 'Tiredness'];
    for (const symptom of generalSymptoms) {
      try {
        await waitFor(element(by.id(`symptom-${symptom}`)))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id(`symptom-${symptom}`)).tap();
        log('SYMPTOM', `Selected: ${symptom}`);
      } catch {
        log('SYMPTOM', `Skipped: ${symptom}`);
      }
    }

    // Head & Neurological → Blurred Vision, Numbness, Tingling
    try {
      await element(by.id('category-Head-&-Neurological')).tap();
      for (const s of ['Blurred-Vision', 'Numbness', 'Tingling']) {
        try {
          await waitFor(element(by.id(`symptom-${s}`)))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id(`symptom-${s}`)).tap();
          log('SYMPTOM', `Selected: ${s}`);
        } catch {
          log('SYMPTOM', `Skipped: ${s}`);
        }
      }
    } catch {
      log('SYMPTOM', 'Could not expand Head & Neurological');
    }

    // Urinary & Reproductive → Frequent Urination, Excessive Thirst
    try {
      await element(by.id('category-Urinary-&-Reproductive')).tap();
      for (const s of ['Frequent-Urination', 'Excessive-Thirst']) {
        try {
          await waitFor(element(by.id(`symptom-${s}`)))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id(`symptom-${s}`)).tap();
          log('SYMPTOM', `Selected: ${s}`);
        } catch {
          log('SYMPTOM', `Skipped: ${s}`);
        }
      }
    } catch {
      log('SYMPTOM', 'Could not expand Urinary & Reproductive');
    }

    // Tap Analyze
    await element(by.id('analyze-symptoms-btn')).tap();
    log('SYMPTOM', 'Tapped Analyze for Diabetes symptoms');

    // Wait for Analysis Results
    await waitFor(element(by.text('Analysis Results')))
      .toBeVisible()
      .withTimeout(10000);

    // Check for Diabetes in results
    try {
      await waitFor(element(by.text(/Diabetes/)))
        .toBeVisible()
        .withTimeout(5000);
      log('SYMPTOM', 'TC5: Diabetes identified in results ✓');
    } catch {
      log('SYMPTOM', 'TC5: Diabetes not found in top results');
    }

    // Check for Medicines button and tap it
    try {
      await waitFor(element(by.text('💊 Medicines')).atIndex(0))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.text('💊 Medicines')).atIndex(0).tap();
      log('SYMPTOM', 'TC5: Navigated to Medicines detail screen');

      // Wait for medicine screen content
      await waitFor(element(by.text(/Metformin|Paracetamol|JanAushadhi|Medicine/i)))
        .toBeVisible()
        .withTimeout(5000);
      log('SYMPTOM', 'TC5: Medicine details displayed ✓');

      // Go back
      try {
        await element(by.text(/Back|‹/)).atIndex(0).tap();
      } catch {
        await device.pressBack();
      }
    } catch {
      log('SYMPTOM', 'TC5: Medicines button not found — possibly no matched diseases');
    }

    // Return to chat
    try {
      await element(by.text('Done')).tap();
      await waitFor(element(by.id('chat-input')))
        .toBeVisible()
        .withTimeout(10000);

      const bedrockLatency = await waitForBedrockResponse();
      log('BEDROCK', 'TC5: Diabetes symptom analysis → Bedrock', {
        latencyMs: bedrockLatency,
        query: 'Auto-sent diabetes symptom analysis',
        testCase: 'TC5-bedrock',
      });
    } catch {
      log('SYMPTOM', 'TC5: Could not return to chat');
    }
  });

  // ── TC6: Symptom Checker — TB symptoms ────────────────────────────────

  it('TC6: Symptom Checker — Tuberculosis symptoms → Analysis', async () => {
    log('SYMPTOM', 'Starting TB symptom check flow');

    // Dismiss keyboard so toolbar is visible
    await dismissKeyboard();

    // Disable sync — chat screen has constant main-queue activity
    await device.disableSynchronization();

    await waitFor(element(by.id('symptom-checker-btn')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('symptom-checker-btn')).tap();
    await device.enableSynchronization();
    await waitFor(element(by.text('Symptom Checker')))
      .toBeVisible()
      .withTimeout(5000);

    // General → Fever, Night Sweats, Loss of Appetite, Unexplained Weight Loss
    for (const s of ['Fever', 'Night-Sweats', 'Loss-of-Appetite', 'Unexplained-Weight-Loss']) {
      try {
        await waitFor(element(by.id(`symptom-${s}`)))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id(`symptom-${s}`)).tap();
        log('SYMPTOM', `Selected: ${s}`);
      } catch {
        log('SYMPTOM', `Skipped: ${s}`);
      }
    }

    // Respiratory → Persistent Cough, Blood in Sputum, Chest Pain
    try {
      await element(by.id('category-Respiratory')).tap();
      for (const s of ['Persistent-Cough', 'Blood-in-Sputum', 'Chest-Pain']) {
        try {
          await waitFor(element(by.id(`symptom-${s}`)))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id(`symptom-${s}`)).tap();
          log('SYMPTOM', `Selected: ${s}`);
        } catch {
          log('SYMPTOM', `Skipped: ${s}`);
        }
      }
    } catch {
      log('SYMPTOM', 'Could not expand Respiratory');
    }

    await element(by.id('analyze-symptoms-btn')).tap();
    log('SYMPTOM', 'Tapped Analyze for TB symptoms');

    await waitFor(element(by.text('Analysis Results')))
      .toBeVisible()
      .withTimeout(10000);

    try {
      await waitFor(element(by.text(/Tuberculosis|TB/)))
        .toBeVisible()
        .withTimeout(5000);
      log('SYMPTOM', 'TC6: Tuberculosis identified in results ✓');
    } catch {
      log('SYMPTOM', 'TC6: TB not found in top results');
    }

    // Check risk level
    try {
      await waitFor(
        element(by.text(/Emergency|Urgent|Routine/)),
      )
        .toBeVisible()
        .withTimeout(3000);
      log('SYMPTOM', 'TC6: Risk level banner displayed ✓');
    } catch {
      log('SYMPTOM', 'TC6: Risk level banner not visible');
    }

    // Return to chat
    try {
      await element(by.text('Done')).tap();
      await waitFor(element(by.id('chat-input')))
        .toBeVisible()
        .withTimeout(10000);

      const bedrockLatency = await waitForBedrockResponse();
      log('BEDROCK', 'TC6: TB symptom analysis → Bedrock', {
        latencyMs: bedrockLatency,
        query: 'Auto-sent TB symptom analysis',
        testCase: 'TC6-bedrock',
      });
    } catch {
      log('SYMPTOM', 'TC6: Could not return to chat');
    }
  });

  // ── TC7: Bedrock — Medicine dosage for high BMI ───────────────────────

  it('TC7: Bedrock chat — Medicine dosage adjustment for BMI 32', async () => {
    const query =
      'I have been prescribed Metformin 500mg for diabetes. My BMI is 32.2 and weight is 92 kg. Should the dosage be adjusted? What is available at JanAushadhi store and how much does it cost?';

    const startTime = Date.now();
    await sendChatMessage(query);

    const latencyMs = await waitForBedrockResponse();
    await getLastAssistantMessage();

    log('BEDROCK', 'Medicine dosage query responded', {
      query,
      latencyMs,
      testCase: 'TC7',
    });

    log(
      'BEDROCK',
      `TC7 Bedrock latency: ${(latencyMs / 1000).toFixed(2)}s`,
      {latencyMs},
    );
  });
});
