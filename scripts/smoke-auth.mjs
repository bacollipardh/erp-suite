const baseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3000/api';
const email = process.env.ERP_ADMIN_EMAIL || 'admin@erp.local';
const password = process.env.ERP_ADMIN_PASSWORD || 'Admin123!';

async function expectOk(response, label) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${label} failed (${response.status}): ${text}`);
  }
  return response;
}

async function main() {
  await expectOk(await fetch(`${baseUrl}/health`), 'health check');

  const loginResponse = await expectOk(
    await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
    'login',
  );
  const login = await loginResponse.json();

  if (!login?.accessToken) {
    throw new Error('login did not return an access token');
  }

  await expectOk(
    await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
      },
    }),
    'auth/me',
  ).then((response) => response.json()).then((me) => {
    if (!me?.id || !Array.isArray(me?.permissions) || typeof me?.role !== 'string') {
      throw new Error('auth/me did not return the expected session payload');
    }
  });

  await expectOk(
    await fetch(`${baseUrl}/dashboard/summary`, {
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
      },
    }),
    'dashboard summary',
  );

  console.log('Smoke auth passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
