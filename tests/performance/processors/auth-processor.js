const { v4: uuidv4 } = require('uuid');

module.exports = {
  createTestUser,
  createTestDeployment,
  generateRandomString,
  setContext
};

/**
 * Creates a test user and sets auth token in context
 */
async function createTestUser(context, events, done) {
  const userEmail = `loadtest-${uuidv4()}@coderunner.io`;
  const userPassword = 'LoadTest123!';
  
  try {
    // Register user
    const registerResponse = await fetch(`${context.vars.target}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Load Test User ${uuidv4()}`,
        email: userEmail,
        password: userPassword
      })
    });

    if (registerResponse.ok) {
      const userData = await registerResponse.json();
      context.vars.authToken = userData.token;
      context.vars.userId = userData.user.id;
      context.vars.testUserEmail = userEmail;
      context.vars.testUserPassword = userPassword;
      
      events.emit('counter', 'auth.user_created', 1);
    } else {
      events.emit('counter', 'auth.user_creation_failed', 1);
      console.error('Failed to create user:', await registerResponse.text());
    }
  } catch (error) {
    events.emit('counter', 'auth.user_creation_error', 1);
    console.error('Error creating user:', error);
  }

  return done();
}

/**
 * Creates a test deployment for scaling/operations tests
 */
async function createTestDeployment(context, events, done) {
  try {
    // First create user if not exists
    if (!context.vars.authToken) {
      await createTestUser(context, events, () => {});
    }

    // Create project
    const projectResponse = await fetch(`${context.vars.target}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.vars.authToken}`
      },
      body: JSON.stringify({
        name: `Load Test Project ${uuidv4()}`,
        description: 'Project for load testing deployments'
      })
    });

    if (projectResponse.ok) {
      const projectData = await projectResponse.json();
      context.vars.projectId = projectData.id;

      // Create deployment
      const deploymentResponse = await fetch(`${context.vars.target}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.vars.authToken}`
        },
        body: JSON.stringify({
          name: `Load Test Deployment ${uuidv4()}`,
          projectId: projectData.id,
          manifest: {
            version: '1.0',
            name: `loadtest-app-${uuidv4()}`,
            type: 'nodejs',
            runtime: { version: '18' },
            start: { command: 'npm start', port: 3000 },
            resources: { cpu: 0.5, memory: 512 }
          }
        })
      });

      if (deploymentResponse.ok) {
        const deploymentData = await deploymentResponse.json();
        context.vars.deploymentId = deploymentData.id;
        events.emit('counter', 'deployment.created', 1);
      } else {
        events.emit('counter', 'deployment.creation_failed', 1);
        console.error('Failed to create deployment:', await deploymentResponse.text());
      }
    } else {
      events.emit('counter', 'project.creation_failed', 1);
      console.error('Failed to create project:', await projectResponse.text());
    }
  } catch (error) {
    events.emit('counter', 'deployment.creation_error', 1);
    console.error('Error creating deployment:', error);
  }

  return done();
}

/**
 * Generates random string for variable values
 */
function generateRandomString(context, events, done) {
  context.vars.randomString = Math.random().toString(36).substring(7);
  return done();
}

/**
 * Sets additional context variables
 */
function setContext(context, events, done) {
  context.vars.timestamp = Date.now();
  context.vars.uuid = uuidv4();
  return done();
}

// Helper function for fetch (if not available in the environment)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}