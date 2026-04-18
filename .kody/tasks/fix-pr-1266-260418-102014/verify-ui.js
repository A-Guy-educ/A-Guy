const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  try {
    // Test 1: Login page loads
    await page.goto('http://localhost:3002/login', { timeout: 20000 });
    const title = await page.title();
    console.log('Login page title:', title);
    await page.screenshot({ path: '/tmp/01-login.png', fullPage: true });
    console.log('✓ Login page loaded');

    // Test 2: Login as admin
    await page.fill('input[type="email"]', 'aguy.aharon.yair@gmail.com');
    await page.fill('input[type="password"]', 'As121212');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account**', { timeout: 15000 });
    console.log('✓ Admin logged in, redirected to account');

    // Test 3: Navigate to instructor page (admin should see Course Oversight)
    await page.goto('http://localhost:3002/instructor', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const headingText = await page.locator('h1').textContent({ timeout: 10000 }).catch(() => 'NOT FOUND');
    console.log('Instructor page heading:', headingText);
    await page.screenshot({ path: '/tmp/02-instructor-admin.png', fullPage: true });
    console.log('✓ Admin instructor page loaded');

    // Test 4: Check API response directly
    const apiResponse = await page.request.get('http://localhost:3002/api/instructor/dashboard');
    const status = apiResponse.status();
    console.log('API /instructor/dashboard status:', status);
    if (status === 200) {
      const data = await apiResponse.json();
      console.log('API response courses count:', data?.data?.courses?.length);
      console.log('First course has instructors:', data?.data?.courses?.[0]?.instructors?.length > 0);
    }

  } catch (err) {
    console.log('Error:', err.message);
    await page.screenshot({ path: '/tmp/error-screenshot.png', { fullPage: true } }).catch(() => {});
  }

  await browser.close();
  console.log('Browser verification complete');
})();
