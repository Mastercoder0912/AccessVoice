#!/usr/bin/env node
/**
 * Test file: Simulate fake Gemini response and test code parsing/execution
 * Skips rendering, directly tests parseGeminiResponse logic
 */

const { exec } = require('child_process');

// The fake response object that ai.py would return
const fakeResponse = {
  text: "Playing Happy by Pharrel Williams on YouTube for you!",
  code: `require('child_process').exec('start "" "https://www.youtube.com/watch?v=ZbZSe6N_BXs&list=RDZbZSe6N_BXs&start_radio=1&pp=ygUYaGFwcHkgcGhhcnJlbGwgd2lsbGlhbXMgoAcB"');`,
  debug: "FAKE_RESPONSE_TEST_MODE"
};

console.log('\n[TEST] Starting response parsing test');
console.log('[TEST] Fake response object:', fakeResponse);
console.log('\n[TEST] Simulating parseGeminiResponse logic...\n');

// Simulate parseGeminiResponse from main.js
function parseGeminiResponse(responseObj) {
  const text = responseObj.text || responseObj.response || '';
  const code = responseObj.code || null;

  console.log('[PARSE RESPONSE] text:', text.substring(0, 50) + '...', 'code:', code ? 'YES' : 'NO');

  if (code) {
    try {
      console.log('[EXECUTING CODE]:', code);
      eval(code);
      console.log('[CODE EXECUTED] Success');
    } catch (err) {
      console.error('[CODE EXECUTION ERROR]:', err);
    }
  }
  
  return text;
}

// Test it
console.log('[TEST] Running parseGeminiResponse with fake response...');
const result = parseGeminiResponse(fakeResponse);

console.log('\n[TEST] Result returned to renderer:', result);
console.log('[TEST] This text would be shown on screen');
console.log('\n[TEST] Response parsing test complete!\n');
