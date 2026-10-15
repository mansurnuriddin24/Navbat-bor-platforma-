async function runTest() {
  console.log('--- Testing Customer Profile 30-Minute Telegram Reminder Toggle ---');
  const baseUrl = 'http://127.0.0.1:3000';

  // 1. Register a test customer
  const email = `cust_${Date.now()}@example.com`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sherzod Karimov',
      email,
      phone: '+998901112233',
      password: 'Password123!',
      role: 'CUSTOMER'
    })
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.token) {
    throw new Error('Registration failed: ' + JSON.stringify(regData));
  }
  const token = regData.token;
  console.log('✅ Customer registered successfully');

  // 2. Fetch profile - verify default reminder_30m_enabled === 1
  const profRes1 = await fetch(`${baseUrl}/api/customer/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const profData1 = await profRes1.json();
  console.log('Default profile:', profData1);
  if (profData1.reminder_30m_enabled !== 1) {
    throw new Error('Expected default reminder_30m_enabled to be 1, got ' + profData1.reminder_30m_enabled);
  }
  console.log('✅ Default reminder_30m_enabled is 1 (enabled)');

  // 3. Update profile to toggle OFF (reminder_30m_enabled = 0)
  const updateRes1 = await fetch(`${baseUrl}/api/customer/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      telegram_chat_id: '99887766',
      reminder_30m_enabled: 0
    })
  });
  const updateData1 = await updateRes1.json();
  if (!updateRes1.ok || updateData1.user.reminder_30m_enabled !== 0) {
    throw new Error('Failed to toggle reminder_30m_enabled to 0: ' + JSON.stringify(updateData1));
  }
  console.log('✅ Successfully toggled reminder_30m_enabled to 0 (disabled)');

  // 4. Fetch profile again to verify persistence in database
  const profRes2 = await fetch(`${baseUrl}/api/customer/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const profData2 = await profRes2.json();
  if (profData2.reminder_30m_enabled !== 0 || profData2.telegram_chat_id !== '99887766') {
    throw new Error('Profile persistence failed: ' + JSON.stringify(profData2));
  }
  console.log('✅ Database persistence verified: reminder_30m_enabled is 0');

  // 5. Update profile to toggle back ON (reminder_30m_enabled = 1)
  const updateRes2 = await fetch(`${baseUrl}/api/customer/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      reminder_30m_enabled: 1
    })
  });
  const updateData2 = await updateRes2.json();
  if (!updateRes2.ok || updateData2.user.reminder_30m_enabled !== 1) {
    throw new Error('Failed to toggle reminder_30m_enabled to 1: ' + JSON.stringify(updateData2));
  }
  console.log('✅ Successfully toggled reminder_30m_enabled back to 1 (enabled)');

  console.log('\nALL 30-MINUTE TELEGRAM REMINDER TOGGLE TESTS PASSED! 🎉\n');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
