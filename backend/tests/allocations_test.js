/*
 Simple integration test for /api/sheets/allocateAll endpoint.
 Requirements:
  - Backend server must be running (default http://localhost:4000)
  - Google Sheets credentials must be configured so the endpoint can write to the sheet.

 Run with:
   node backend/tests/allocations_test.js

 This script will POST a small payload and assert a successful JSON response.
*/

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function main() {
  console.log('Running allocation endpoint integration test against', BASE);

  const payload = {
    toAllocate: [
      {
        Seller_ID: 'TEST_SELLER_001',
        Seller_name: 'Test Seller',
        Resource_Email: 'test.user@example.com',
        Assigned_by: 'test-runner',
        Allocation_Status: 'ALLOCATED',
        Assigned_Timestamp: new Date().toISOString().replace('T', ' ').split('.')[0]
      }
    ],
    toUnallocate: []
  };

  try {
    const res = await fetch(`${BASE}/api/sheets/allocateAll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await res.json();
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(body, null, 2));

    if (!res.ok || !body || body.success !== true) {
      console.error('Test FAILED: allocateAll did not return success.');
      process.exit(2);
    }

    console.log('Test PASSED: allocateAll returned success.');
    process.exit(0);
  } catch (err) {
    console.error('Test ERROR:', err);
    process.exit(3);
  }
}

main();
