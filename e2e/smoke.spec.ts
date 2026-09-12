import{expect,test}from'@playwright/test';test('SkillOrbit exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'SkillOrbit command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();await expect(page.getByRole('region',{name:'Prerequisite planner'})).toContainText(/blocked|valid/);await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('retake submission recovers from revised assessment rules and persists completion', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const action = async (name: string) => page.getByRole('button', { name, exact: true }).click();
    const save = async () => { await action('Save command'); await expect(page.getByRole('dialog')).toHaveCount(0); };
    await action('Publish course'); await save();
    await actor.selectOption('actor-1'); await page.getByRole('button', { name: /^Assessment attempts/ }).click();
    await action('Submit assessment result'); await save(); await action('Create assessment retake'); await save();
    await actor.selectOption('actor-0'); await page.getByRole('button', { name: /^Courses / }).click();
    await action('Publish revised assessment rules');
    await page.getByRole('dialog').getByRole('spinbutton', { name: 'New passing score', exact: true }).fill('95'); await save();
    await actor.selectOption('actor-1'); await page.getByRole('button', { name: /^Assessment attempts/ }).click();
    await page.getByRole('button', { name: /^Retake · Secure/ }).click(); await action('Submit retake result');
    await page.getByRole('dialog').getByRole('spinbutton', { name: 'Retake score', exact: true }).fill('96'); await action('Save command');
    await expect(page.getByRole('alert')).toContainText('rules changed'); await page.keyboard.press('Escape');
    await action('Refresh retake rules'); await save(); await action('Submit retake result');
    await page.getByRole('dialog').getByRole('spinbutton', { name: 'Retake score', exact: true }).fill('96'); await save();
    await page.reload(); await page.getByRole('button', { name: /^Course completions/ }).click();
    await expect(page.locator('.detail')).toContainText('Completed rule version2');
    await page.getByRole('button', { name: /^Assessment attempts/ }).click();
    await page.getByRole('button', { name: /^Omar · SCF/ }).click(); await expect(page.locator('.detail-title')).toContainText('failed');
});
