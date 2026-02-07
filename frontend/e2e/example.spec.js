const { test, expect } = require("@playwright/test");

test("homepage has correct title and search bar", async ({ page }) => {
    await page.goto("/");

    // Check title
    await expect(page).toHaveTitle(/CEI/);

    // Check for main heading or search element
    // Adjust selector based on actual homepage content
    const searchInput = page.getByPlaceholderText(/Search/i);
    await expect(searchInput).toBeVisible();
});

test("navigation to colleges page works", async ({ page }) => {
    await page.goto("/");

    // Find navigation link to colleges
    await page.getByRole('link', { name: /Colleges/i }).click();

    await expect(page).toHaveURL(/.*colleges/);
});
