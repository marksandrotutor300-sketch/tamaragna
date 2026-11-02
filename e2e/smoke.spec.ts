import { expect, test } from "@playwright/test";

test("landing and bestiary detail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Raise a/i);

  await page.goto("/bestiary/1002");
  await expect(page.getByText("Poring").first()).toBeVisible();
});

test("hatch, reveal, and ranch", async ({ page }) => {
  await page.goto("/hatch");
  await expect(page.getByRole("heading", { name: /Crack an egg/i })).toBeVisible();

  await page.getByRole("button", { name: /^Hatch — 1 egg$/ }).click();

  const dialog = page.getByRole("dialog", { name: "Hatch result" });
  await expect(dialog).toBeVisible();
  const name = (await dialog.locator("h2").textContent())?.trim();
  expect(name && name.length > 0).toBeTruthy();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/ranch");
  await expect(page.getByText(name!, { exact: true }).first()).toBeVisible();
});

test("quests page", async ({ page }) => {
  await page.goto("/quests");
  await expect(page.getByRole("heading", { name: "Quests" })).toBeVisible();
  await expect(page.getByText(/login streak/i)).toBeVisible();
  await expect(page.getByText("Tender care")).toBeVisible();
  await expect(page.getByText("Duelist")).toBeVisible();
});

test("account page offers transfer and save tools", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: /Account & saves/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create transfer code/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download save/i })).toBeVisible();
  await page.getByRole("link", { name: /transfer page/i }).click();
  await expect(page.getByRole("heading", { name: /Move your ranch/i })).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: /Create transfer code/i }).click();
  await expect(page.getByText(/^Expires /)).toBeVisible();
});

test("publishes a public trainer card", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: /Account & saves/i })).toBeVisible();

  const slug = `e2e-${Date.now().toString(36)}`;
  await page.getByPlaceholder("your-name").fill(slug);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Save card/i }).click();

  await expect(page.getByText(/Trainer card published/i)).toBeVisible();
  await page.getByRole("link", { name: /Open card/i }).click();
  await expect(page).toHaveURL(new RegExp(`/trainer/${slug}`));
  await expect(page.getByText("public trainer card")).toBeVisible();
});

test("shares a battle and opens its replay", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/hatch");
  await page.getByRole("button", { name: /^Hatch — 1 egg$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Hatch result" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.goto("/bestiary/1002");
  await page.getByRole("button", { name: /Practice against Poring/i }).click();
  await expect(page).toHaveURL(/\/battle\//);
  const battleId = new URL(page.url()).pathname.split("/").filter(Boolean).pop() ?? "";
  expect(battleId.length).toBeGreaterThan(0);

  await expect(
    page.getByRole("heading", { name: /Victory|Defeat|Draw/ }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("button", { name: /Share replay/i })).toBeVisible();
  await page.getByRole("button", { name: /Share replay/i }).click();

  const openReplay = page.getByRole("link", { name: /Open replay/i });
  await expect(openReplay).toBeVisible();
  await openReplay.click();
  await expect(page).toHaveURL(/\/replay\//);
  await expect(page.getByText("shared replay")).toBeVisible();

  const replayToken =
    new URL(page.url()).pathname.split("/").filter(Boolean).pop() ?? "";
  expect(replayToken.length).toBeGreaterThan(0);

  const revoke = await page.request.delete(`/api/battles/${battleId}/share`);
  expect(revoke.ok()).toBeTruthy();
  const revokedReplay = await page.request.get(`/api/replays/${replayToken}`);
  expect(revokedReplay.status()).toBe(404);
});

test("new upgrade hub pages render", async ({ page }) => {
  const pages: Array<[string, RegExp]> = [
    ["/more", /The wider ranch/],
    ["/guild", /Guild hall/],
    ["/market", /Auction house/],
    ["/expeditions", /Expeditions/],
    ["/ranked", /Ranked circuit/],
    ["/legacy", /Legacy/],
    ["/dojo", /Ghost dojo/],
  ];

  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
});
