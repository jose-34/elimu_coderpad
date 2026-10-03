const { test, expect, PASSWORD } = require('./fixtures');

test('register, sign out, and sign back in', async ({ page, interviewer }) => {
  await expect(page.getByText(`${interviewer.firstName} ${interviewer.lastName}`)).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill(interviewer.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('No interviews yet')).toBeVisible();
});

test('protected pages redirect to sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('an invalid join link shows an error instead of loading forever', async ({ page }) => {
  await page.goto('/join/ZZZZZZ');
  await expect(page.getByText('This interview link is invalid')).toBeVisible();
});
