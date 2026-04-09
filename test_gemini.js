/**
 * Direct test of Gemini API integration
 */
const { spawn } = require('child_process');
const path = require('path');

let python = null;
let testResults = [];

function initPythonProcess() {
  if (python) return;

  python = spawn('C:/Users/aamal/.vscode/.vscode/venv/Scripts/python.exe', ['ai.py'], { 
    cwd: __dirname,
    env: { ...process.env, GOOGLE_API_KEY: process.env.GOOGLE_API_KEY }
  });

  python.stderr.on('data', (data) => {
    console.log(`Python stderr: ${data}`);
  });

  python.on('error', (err) => {
    console.error('Failed to spawn Python process:', err);
    python = null;
  });

  python.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    python = null;
  });

  python.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      console.log('[PYTHON OUTPUT]', message);
      try {
        const response = JSON.parse(message);
        testResults.push(response);
        console.log('[TEST RESULT]', response);
      } catch (e) {
        console.log('[RAW OUTPUT]', message);
      }
    }
  });
}

function sendToGemini(prompt) {
  return new Promise((resolve, reject) => {
    if (!python) {
      initPythonProcess();
    }

    if (!python) {
      reject(new Error('Python process not available'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for Gemini response'));
    }, 10000);

    const responseHandler = (data) => {
      clearTimeout(timeout);
      python.stdout.removeListener('data', responseHandler);
      const message = data.toString().trim();
      try {
        const response = JSON.parse(message);
        resolve(response);
      } catch (e) {
        resolve({ response: message, error: 'Parse error' });
      }
    };

    python.stdout.once('data', responseHandler);
    python.stdin.write(JSON.stringify({ prompt }) + '\n');
  });
}

async function runTests() {
  console.log('========== HELPER-APP TEST SUITE ==========\n');

  // Test 1: Simple greeting response
  console.log('TEST 1: Testing Gemini with simple greeting...');
  try {
    const result1 = await sendToGemini('hello');
    console.log('✅ TEST 1 PASSED:', result1.response || result1);
  } catch (err) {
    console.error('❌ TEST 1 FAILED:', err.message);
  }

  // Test 2: YouTube command
  console.log('\nTEST 2: Testing Gemini with YouTube command...');
  try {
    const result2 = await sendToGemini('open youtube');
    console.log('✅ TEST 2 PASSED:', result2.response || result2);
    if (result2.code) {
      console.log('  Code extracted:', result2.code);
    }
  } catch (err) {
    console.error('❌ TEST 2 FAILED:', err.message);
  }

  // Test 3: Query
  console.log('\nTEST 3: Testing Gemini with query...');
  try {
    const result3 = await sendToGemini('what time is it');
    console.log('✅ TEST 3 PASSED:', result3.response || result3);
  } catch (err) {
    console.error('❌ TEST 3 FAILED:', err.message);
  }

  console.log('\n========== TEST SUITE COMPLETE ==========\n');
  console.log('Results:', testResults);

  // Exit
  setTimeout(() => {
    if (python) {
      python.kill();
    }
    process.exit(0);
  }, 1000);
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  if (python) python.kill();
  process.exit(1);
});
