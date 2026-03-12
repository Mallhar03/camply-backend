const http = require('http');

const data = JSON.stringify({
  name: "Test User",
  username: "testuser",
  email: "test@example.com",
  password: "Password123"
});

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
