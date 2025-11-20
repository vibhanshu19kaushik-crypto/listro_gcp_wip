const fs = require('fs');
const path = require('path');

console.log('🔍 GCP Configuration Diagnostic\n');

// Check 1: Current directory
console.log('1. Current Directory:');
console.log('   ', process.cwd());
console.log('');

// Check 2: Environment variables
console.log('2. Environment Variables:');
console.log('   GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID || 'NOT SET');
console.log('   GCP_KEY_FILE:', process.env.GCP_KEY_FILE || 'NOT SET');
console.log('');

// Check 3: Key file existence
const keyFile = process.env.GCP_KEY_FILE || './gcp-service-account-key.json';
console.log('3. Key File Check:');
console.log('   Looking for:', keyFile);
console.log('   Exists:', fs.existsSync(keyFile));
console.log('   Absolute path:', path.resolve(keyFile));
console.log('');

// Check 4: Key file content (if exists)
if (fs.existsSync(keyFile)) {
  console.log('4. Key File Content:');
  try {
    const keyContent = fs.readFileSync(keyFile, 'utf8');
    const credentials = JSON.parse(keyContent);
    console.log('   ✅ Valid JSON');
    console.log('   Project ID:', credentials.project_id);
    console.log('   Client Email:', credentials.client_email);
  } catch (error) {
    console.log('   ❌ Invalid JSON:', error.message);
  }
} else {
  console.log('4. Key File Content: FILE NOT FOUND');
}
console.log('');

// Check 5: Test BigQuery initialization
console.log('5. BigQuery Initialization Test:');
try {
  const { BigQuery } = require('@google-cloud/bigquery');
  
  const bigquery = new BigQuery({
    keyFilename: keyFile,
    projectId: process.env.GCP_PROJECT_ID,
  });
  
  console.log('   ✅ BigQuery client initialized successfully');
} catch (error) {
  console.log('   ❌ BigQuery initialization failed:');
  console.log('   Error:', error.message);
}