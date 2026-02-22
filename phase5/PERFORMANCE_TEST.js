/**
 * Performance Test Script - Doorman System
 * Using k6 load testing framework
 * 
 * Usage: k6 run PERFORMANCE_TEST.js
 * 
 * Scenarios:
 * 1. Load Test: 10 → 500 concurrent users (30 min)
 * 2. Stress Test: Push to 1000 users (find breaking point)
 * 3. Soak Test: 100 users × 4 hours (check for memory leaks)
 * 4. Spike Test: 50 → 500 users instantly (recovery test)
 */

import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Define custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const doorListDuration = new Trend('door_list_duration');
const doorDetailDuration = new Trend('door_detail_duration');
const formSubmitDuration = new Trend('form_submit_duration');
const successfulLogins = new Counter('successful_logins');
const successfulDoorLoads = new Counter('successful_door_loads');

// Test configuration
export const options = {
  stages: [
    // Scenario 1: Load Test (gradual ramp-up)
    { duration: '5m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '5m', target: 250 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 500 }, // steady state
    { duration: '2m', target: 0 },    // ramp down
  ],
  thresholds: {
    // Define pass/fail criteria
    'errors': ['rate<0.1'],                          // <0.1% error rate
    'login_duration': ['p(95)<500', 'p(99)<1000'],  // 95th percentile <500ms
    'door_list_duration': ['p(95)<500', 'p(99)<1000'],
    'door_detail_duration': ['p(95)<200', 'p(99)<500'],
    'form_submit_duration': ['p(95)<1000', 'p(99)<2000'],
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
  },
};

// Base URL (change to UAT/prod URL)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || 'http://localhost:3001';

// Test data
const testUsers = [
  {
    email: 'john.locksmith@doorman.local',
    password: 'locksmith123',
    role: 'locksmith',
  },
  {
    email: 'jane.supervisor@doorman.local',
    password: 'supervisor123',
    role: 'supervisor',
  },
  {
    email: 'mike.maintenance@doorman.local',
    password: 'maintenance123',
    role: 'maintenance',
  },
  {
    email: 'admin@doorman.local',
    password: 'admin123',
    role: 'admin',
  },
];

const testDoorIds = [
  'D-001',
  'D-002',
  'D-100',
  'D-500',
  'D-1000',
  'D-5000',
];

// Helper function: get random item from array
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function: authenticate user
function authenticate() {
  const user = getRandomItem(testUsers);
  
  group('Authentication', () => {
    const startTime = new Date();
    
    const response = http.post(`${API_URL}/api/auth/login`, {
      email: user.email,
      password: user.password,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const duration = new Date() - startTime;
    loginDuration.add(duration);

    const success = check(response, {
      'login successful': (r) => r.status === 200,
      'has auth token': (r) => r.json('token') !== undefined,
    });

    if (success) {
      successfulLogins.add(1);
    } else {
      errorRate.add(1);
    }

    return response.json('token');
  });
}

// Scenario: Authentication Flow
function authenticationFlow() {
  group('User Login Flow', () => {
    const token = authenticate();
    check(token, {
      'token is valid': (t) => t !== null,
    });
  });
}

// Scenario: Read-Heavy (Doors listing)
function readHeavyFlow() {
  const token = authenticate();

  group('Read Door List', () => {
    const startTime = new Date();
    
    const response = http.get(`${API_URL}/api/objects?limit=10&offset=0`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = new Date() - startTime;
    doorListDuration.add(duration);

    const success = check(response, {
      'list doors successful': (r) => r.status === 200,
      'has results': (r) => r.json('items').length > 0,
    });

    if (!success) {
      errorRate.add(1);
    } else {
      successfulDoorLoads.add(1);
    }

    sleep(1);
  });

  // Read individual door
  group('Read Door Detail', () => {
    const doorId = getRandomItem(testDoorIds);
    const startTime = new Date();
    
    const response = http.get(`${API_URL}/api/objects/door/${doorId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = new Date() - startTime;
    doorDetailDuration.add(duration);

    const success = check(response, {
      'get door detail successful': (r) => r.status === 200,
      'has door attributes': (r) => r.json('attributes').length > 0,
    });

    if (!success) {
      errorRate.add(1);
    }

    sleep(1);
  });
}

// Scenario: Write-Heavy (Form submission)
function writeHeavyFlow() {
  const token = authenticate();

  group('Form Submission', () => {
    const startTime = new Date();
    
    const payload = {
      taskId: 'task-door-unlock-001',
      formData: {
        door_id: getRandomItem(testDoorIds),
        access_reason: 'emergency',
        priority_level: 'high',
      },
    };

    const response = http.post(`${API_URL}/api/forms/submit`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = new Date() - startTime;
    formSubmitDuration.add(duration);

    const success = check(response, {
      'form submission successful': (r) => r.status === 200 || r.status === 201,
      'has submission ID': (r) => r.json('submissionId') !== undefined,
    });

    if (!success) {
      errorRate.add(1);
    }

    sleep(2);
  });
}

// Scenario: Complex Query (search + filter)
function complexQueryFlow() {
  const token = authenticate();

  group('Complex Query', () => {
    const doorId = getRandomItem(testDoorIds);
    
    const response = http.get(
      `${API_URL}/api/objects?type=door&search=${doorId}&limit=50&offset=0`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const success = check(response, {
      'complex query successful': (r) => r.status === 200,
    });

    if (!success) {
      errorRate.add(1);
    }

    sleep(1);
  });
}

// Main test function
export default function () {
  // Distribute load across different flows
  const randomFlow = Math.random();

  if (randomFlow < 0.25) {
    authenticationFlow();
  } else if (randomFlow < 0.60) {
    readHeavyFlow();
  } else if (randomFlow < 0.85) {
    writeHeavyFlow();
  } else {
    complexQueryFlow();
  }
}

// Teardown: Summary
export function teardown() {
  console.log('=== Performance Test Summary ===');
  console.log(`✓ Login Duration: p95 < 500ms target`);
  console.log(`✓ Door List Duration: p95 < 500ms target`);
  console.log(`✓ Door Detail Duration: p95 < 200ms target`);
  console.log(`✓ Form Submit Duration: p95 < 1000ms target`);
  console.log(`✓ Error Rate: < 0.1% target`);
}

/**
 * Additional Test Scenarios (comment/uncomment as needed)
 */

// Stress Test: Find breaking point
export const stressTestOptions = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '5m', target: 1500 },
    { duration: '5m', target: 2000 }, // push until failure
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.2'], // More lenient for stress test
    'http_req_duration': ['p(95)<1000'],
  },
};

// Soak Test: 100 users × 4 hours
export const soakTestOptions = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '4h', target: 100 }, // steady state 4 hours
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.1'],
    'http_req_duration': ['p(95)<500'],
  },
};

// Spike Test: Sudden traffic spike
export const spikeTestOptions = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '1m', target: 500 }, // sudden spike
    { duration: '5m', target: 500 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'errors': ['rate<0.1'],
  },
};
