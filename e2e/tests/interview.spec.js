const { test, expect, createSession, openSession, typeInEditor, editorText } = require('./fixtures');

test('interviewer and candidate edit the same code live', async ({ page, interviewer, candidatePage }) => {
  const { sessionCode } = await createSession(page, { candidateName: 'Ada Lovelace' });
  await openSession(page, 'Ada Lovelace');

  await candidatePage.goto(`/join/${sessionCode}`);
  await candidatePage.getByPlaceholder('Your full name').fill('Ada Lovelace');
  await candidatePage.getByRole('button', { name: 'Join interview' }).click();
  await expect(candidatePage.getByText('Interview questions')).toBeVisible();
  await expect(candidatePage.getByText(/^Q1\.1/)).toBeVisible();
  // Scoring is interviewer-only.
  await expect(candidatePage.getByText('Assessment')).toHaveCount(0);

  await expect(page.getByText('1 other online')).toBeVisible();

  await typeInEditor(candidatePage, 'print("from candidate")');
  await expect(editorText(page)).toHaveText('print("from candidate")');

  await typeInEditor(page, 'print("from interviewer")');
  await expect(editorText(candidatePage)).toHaveText('print("from interviewer")');

  // The snapshot is persisted server-side (every ~5s) for refreshes/rejoins.
  await expect(async () => {
    await candidatePage.reload();
    await candidatePage.getByPlaceholder('Your full name').fill('Ada Lovelace');
    await candidatePage.getByRole('button', { name: 'Join interview' }).click();
    await expect(editorText(candidatePage)).toHaveText('print("from interviewer")', { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
});

test('runs JavaScript in the browser sandbox and shows output and errors', async ({ page, interviewer }) => {
  await createSession(page, { candidateName: 'Linus JS', language: 'javascript' });
  await openSession(page, 'Linus JS');

  const run = page.getByRole('button', { name: 'Run ▶' });
  const output = page.locator('pre');

  await typeInEditor(page, 'console.log("answer", 6 * 7)');
  await run.click();
  await expect(output).toHaveText('answer 42');

  await typeInEditor(page, 'throw new Error("boom")');
  await run.click();
  await expect(output.locator('.text-red-400')).toHaveText(/boom/);
});

test('scores a candidate, records red flags, and ranks them on the dashboard', async ({ page, interviewer }) => {
  await createSession(page, { candidateName: 'Grace Scored' });
  await openSession(page, 'Grace Scored');

  await page.getByRole('button', { name: 'Start interview' }).click();
  await expect(page.getByRole('button', { name: 'End interview' })).toBeVisible();

  const badge = page.getByText(/^\d+\/64/).first();
  const questionCards = page.locator('div.rounded-md.border', { has: page.getByPlaceholder('Notes…') });
  await expect(questionCards).toHaveCount(16);

  // 13 questions x 4 stars = 52 -> HIRE
  for (let i = 0; i < 13; i++) {
    await questionCards.nth(i).getByTitle('4 / 4').click();
    await expect(badge).toHaveText(new RegExp(`^${(i + 1) * 4}/64`));
  }
  await expect(badge).toHaveText('52/64 HIRE');

  await questionCards.first().getByPlaceholder('Notes…').fill('Great analogy for sprites');
  await page.getByLabel('Red flags').check();
  await page.getByRole('button', { name: 'Save final assessment' }).click();
  await expect(badge).toHaveText('52/64 RISKY');

  // Everything survives a reload.
  await page.reload();
  await expect(badge).toHaveText('52/64 RISKY');
  await expect(page.getByLabel('Red flags')).toBeChecked();
  await expect(questionCards.first().getByPlaceholder('Notes…')).toHaveValue('Great analogy for sprites');

  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(page.getByText('completed', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'KEMSAP CodeLive' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('listitem').filter({ hasText: 'Grace Scored' })).toContainText('52/64 RISKY');
  await expect(page.getByText('Total interviews').locator('..')).toContainText('1');
});
