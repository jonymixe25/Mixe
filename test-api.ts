
import fetch from 'node-fetch';

async function testLocalApi() {
  const baseUrl = 'http://0.0.0.0:3000';
  
  const endpoints = [
    '/api/ping',
    '/api/health',
    '/api/livekit/test'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const res = await fetch(`${baseUrl}${endpoint}`);
      console.log(`Endpoint ${endpoint}: Status ${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Endpoint ${endpoint} response:`, JSON.stringify(data).substring(0, 100));
      } else {
        const text = await res.text();
        console.log(`Endpoint ${endpoint} error body:`, text.substring(0, 100));
      }
    } catch (err) {
      console.error(`Error testing ${endpoint}:`, err.message);
    }
  }
}

testLocalApi();
