const fs = require('fs');

async function testUpload() {
  console.log('Testing login...');
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@beautybook.com', password: 'password123' })
    });
    
    if (!loginRes.ok) {
      console.error('Login failed:', await loginRes.text());
      return;
    }
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    console.log('Login success! Got token.');

    console.log('Testing service upload with a dummy image/jfif data URL...');
    const dummyPayload = {
      name: 'Test Service Upload ' + Date.now(),
      description: 'Test',
      price: 100000,
      duration: 60,
      category: 'Tóc',
      status: 'active',
      image_url: '',
      image_data: 'data:image/jfif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    };

    const uploadRes = await fetch('http://localhost:5000/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dummyPayload)
    });

    const uploadData = await uploadRes.json();
    console.log('Upload Response:', uploadData);
  } catch (error) {
    console.error('Error:', error);
  }
}

testUpload();
