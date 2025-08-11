const axios = require('axios');

const API_BASE = 'http://localhost:8088/api';

async function testConfigurationAPI() {
  console.log('🧪 Testing Configuration Management API');
  
  try {
    // First, let's register a test user to get a token
    console.log('\n1. 📝 Registering test user...');
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      email: 'config-test@example.com',
      password: 'testPassword123!'
    });
    
    if (!registerResponse.data.success) {
      throw new Error('Failed to register test user');
    }
    
    console.log('✅ Test user registered successfully');
    
    // Login to get token
    console.log('\n2. 🔑 Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'config-test@example.com',
      password: 'testPassword123!'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Failed to login');
    }
    
    const token = loginResponse.data.data.token;
    const userId = loginResponse.data.data.user.id;
    console.log('✅ Logged in successfully');
    
    // Create headers for authenticated requests
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Create a test project
    console.log('\n3. 📁 Creating test project...');
    // We need to use the database directly since there's no projects API yet
    // For now, let's test the template endpoints which don't require a project
    
    // Test getting configuration templates
    console.log('\n4. 📋 Testing configuration templates...');
    const templatesResponse = await axios.get(`${API_BASE}/config/templates`, {
      headers: authHeaders
    });
    
    if (!templatesResponse.data.success) {
      throw new Error('Failed to get templates');
    }
    
    console.log('✅ Retrieved configuration templates:', templatesResponse.data.data.length);
    console.log('📋 Available templates:');
    templatesResponse.data.data.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.name} (${template.category})`);
    });
    
    // Test getting a specific template
    if (templatesResponse.data.data.length > 0) {
      const templateId = templatesResponse.data.data[0].id;
      console.log(`\n5. 📄 Testing specific template retrieval (${templateId})...`);
      
      const templateResponse = await axios.get(`${API_BASE}/config/templates/${templateId}`, {
        headers: authHeaders
      });
      
      if (!templateResponse.data.success) {
        throw new Error('Failed to get specific template');
      }
      
      console.log('✅ Retrieved specific template:', templateResponse.data.data.name);
      console.log('📝 Template variables:', templateResponse.data.data.templateData.variables.length);
    }
    
    // Test API info endpoint to see if config routes are listed
    console.log('\n6. 🔍 Checking API info...');
    const infoResponse = await axios.get(`${API_BASE}/`);
    
    if (infoResponse.data.success) {
      console.log('✅ API info retrieved');
      console.log('🔗 Available endpoints:', Object.keys(infoResponse.data.data.endpoints));
      
      if (infoResponse.data.data.endpoints.config) {
        console.log('✅ Configuration endpoints are listed:', infoResponse.data.data.endpoints.config);
      } else {
        console.log('❌ Configuration endpoints not found in API info');
      }
    }
    
    console.log('\n🎉 Configuration API test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Configuration API test failed:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testConfigurationAPI();