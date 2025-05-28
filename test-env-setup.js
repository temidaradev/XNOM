#!/usr/bin/env node

/**
 * Test Environment Setup for XNOM OAuth Authentication
 * 
 * This script sets up a test environment with mock credentials for testing
 * the OAuth authentication flow without requiring real Twitter app credentials.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');

// Generate random values for testing
const generateSecret = () => crypto.randomBytes(32).toString('hex');
const generateKey = () => crypto.randomBytes(16).toString('hex');

// Mock Twitter app credentials for testing (these won't work with real Twitter API)
const testConfig = {
  'TWITTER_CONSUMER_KEY': 'test_consumer_key_' + generateKey(),
  'TWITTER_CONSUMER_SECRET': 'test_consumer_secret_' + generateSecret(),
  'TWITTER_CALLBACK_URL': 'http://localhost:3000/auth/twitter/callback',
  'JWT_SECRET': generateSecret(),
  'SESSION_SECRET': generateSecret(),
  'X_API_KEY': 'test_x_api_key_' + generateKey(),
  'X_API_SECRET': 'test_x_api_secret_' + generateSecret(),
  'X_ACCESS_TOKEN': 'test_access_token_' + generateKey(),
  'X_ACCESS_TOKEN_SECRET': 'test_access_token_secret_' + generateSecret(),
  'X_BEARER_TOKEN': 'test_bearer_token_' + generateSecret(),
  'OPENAI_API_KEY': 'test_openai_key_' + generateKey(),
  'NODE_ENV': 'development',
  'PORT': '3000',
  'DATABASE_PATH': './data/xnom.db'
};

console.log('🔧 Setting up test environment for XNOM OAuth authentication...');

try {
  // Read current .env file
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update with test values
  Object.entries(testConfig).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  });
  
  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Test environment configured successfully!');
  console.log('\n📝 Test Configuration Summary:');
  console.log('- Mock Twitter OAuth credentials generated');
  console.log('- JWT and session secrets generated');
  console.log('- Database path configured');
  console.log('\n⚠️  Note: These are test credentials and will not work with real Twitter API');
  console.log('💡 For production, replace with real Twitter app credentials from developer.twitter.com');
  
  console.log('\n🚀 To test the OAuth flow:');
  console.log('1. npm run dev');
  console.log('2. Open http://localhost:3000');
  console.log('3. Click "Sign in with X" (will fail at Twitter, but auth routes will work)');
  
} catch (error) {
  console.error('❌ Error setting up test environment:', error.message);
  process.exit(1);
}
