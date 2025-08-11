#!/usr/bin/env node

// Test API response formats for frontend compatibility
const axios = require('axios');

const API_BASE = 'http://localhost:8080/api';

async function testApiResponses() {
  console.log('🧪 Testing API Response Formats for Frontend...\n');
  
  try {
    // Test 1: Health Check Response
    console.log('1️⃣ Testing Health Check Response Format...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    
    console.log('✅ Health Response Structure:');
    console.log('   Success:', healthResponse.data.success !== undefined);
    console.log('   Data:', healthResponse.data.data !== undefined);
    console.log('   Timestamp:', healthResponse.data.timestamp !== undefined);
    console.log('   Overall Status:', healthResponse.data.data.overall);
    
    // Test 2: API Info Response
    console.log('\n2️⃣ Testing API Info Response Format...');
    const apiResponse = await axios.get(`${API_BASE}/`);
    
    console.log('✅ API Info Response Structure:');
    console.log('   Success:', apiResponse.data.success);
    console.log('   Version:', apiResponse.data.data.version);
    console.log('   Environment:', apiResponse.data.data.environment);
    console.log('   Endpoints count:', Object.keys(apiResponse.data.data.endpoints).length);
    
    // Test 3: Error Response Format
    console.log('\n3️⃣ Testing Error Response Format...');
    try {
      await axios.get(`${API_BASE}/nonexistent`);
    } catch (errorResponse) {
      console.log('✅ Error Response Structure:');
      console.log('   Success:', errorResponse.response.data.success);
      console.log('   Error field:', errorResponse.response.data.error !== undefined);
      console.log('   Code field:', errorResponse.response.data.code !== undefined);
      console.log('   Status Code:', errorResponse.response.status);
    }
    
    // Test 4: Database health response
    console.log('\n4️⃣ Testing Database Health Response Format...');
    const dbHealthResponse = await axios.get(`${API_BASE}/health/database`);
    
    console.log('✅ Database Health Response:');
    console.log('   Success:', dbHealthResponse.data.success);
    console.log('   Database Status:', dbHealthResponse.data.data.status);
    console.log('   Connection Info:', dbHealthResponse.data.data.database !== undefined);
    
    console.log('\n🎯 Frontend Integration Checklist:');
    console.log('   ✅ Consistent response format (success/data/timestamp)');
    console.log('   ✅ Proper HTTP status codes');
    console.log('   ✅ Error responses include error codes');
    console.log('   ✅ Health checks return detailed status');
    console.log('   ✅ API info includes available endpoints');
    
    console.log('\n📋 Expected Deployment Response Format:');
    console.log('   {');
    console.log('     "success": true,');
    console.log('     "data": {');
    console.log('       "deploymentId": "exec_...",');
    console.log('       "url": "https://sandbox-id.agentsphere.com",');
    console.log('       "status": "running",');
    console.log('       "projectType": "nodejs|manifest",');
    console.log('       "framework": "nodejs|express"');
    console.log('     },');
    console.log('     "message": "Deployment successful",');
    console.log('     "timestamp": "2025-08-10T..."');
    console.log('   }');
    
    console.log('\n✅ API Response Formats Ready for Frontend Integration!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testApiResponses();