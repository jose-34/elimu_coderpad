const base = require('@playwright/test');

const PASSWORD = 'correct-horse-battery';
let counter = 0;

function uniqueEmail(prefix = 'interviewer') {
  counter += 1;
  return `${prefix}-${Date.now()}-${process.pid}-${counter}@example.com`;
}

// Third-party runtime dependencies (Jitsi video, the Pyodide CDN) are out of
// scope here: fail them fast so tests are deterministic and work offline.
async function blockThirdParty(context) {
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
}

const test = base.test.extend({
  context: async ({ context }, use) => {
    await blockThirdParty(context);
    await use(context);
  },

  // A freshly registered interviewer, signed in on `page`.
  interviewer: async ({ page }, use) => {
    const user = { firstName: 'Grace', lastName: 'Hopper', email: uniqueEmail(), password: PASSWORD };
    await page.goto('/register');
    await page.getByLabel('First name').fill(user.firstName);
    await page.getByLabel('Last name').fill(user.lastName);
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await base.expect(page).toHaveURL(/\/dashboard$/);
    await use(user);
  },

  // A second, isolated browser (no shared storage) for the candidate.
  candidatePage: async ({ browser }, use) => {
    const context = await browser.newContext();
    await blockThirdParty(context);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

async function createSession(page, { candidateName = 'Ada Lovelace', language = 'python' } = {}) {
  await page.getByLabel('Candidate name').fill(candidateName);
  await page.getByLabel('Candidate email').fill('ada@example.com');
  await page.getByLabel('Language').selectOption(language);
  await page.getByRole('button', { name: 'Create session' }).click();
  const banner = page.getByText(/Session code/);
  await base.expect(banner).toBeVisible();
  const sessionCode = (await banner.locator('span.font-mono').first().innerText()).trim();
  return { sessionCode };
}

async function openSession(page, candidateName) {
  await page.getByRole('row', { name: new RegExp(candidateName) }).getByRole('button', { name: 'Open' }).click();
  await base.expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/);
  await base.expect(page.locator('.monaco-editor').first()).toBeVisible();
}

// Monaco auto-closes brackets/quotes on keystrokes; insertText bypasses that.
async function typeInEditor(page, text) {
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
}

function editorText(page) {
  return page.locator('.monaco-editor .view-lines').first();
}

module.exports = {
  test,
  expect: base.expect,
  PASSWORD,
  uniqueEmail,
  createSession,
  openSession,
  typeInEditor,
  editorText,
};
