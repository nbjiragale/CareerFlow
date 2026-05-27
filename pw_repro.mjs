import { chromium } from "@playwright/test";

const BASE = "http://localhost:3737";
const EMAIL = "jiragalen@gmail.com";
const PASSWORD = "Niranjan@9742";

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(60000);

// capture the AI endpoint response
let evalResp = null;
page.on("response", async (r) => {
  if (r.url().includes("/api/evaluate")) {
    let body = "";
    try { body = await r.text(); } catch {}
    evalResp = { status: r.status(), body: body.slice(0, 600) };
  }
});

console.log("1) login");
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let React hydrate so submit is handled client-side, not a native POST
await page.getByPlaceholder("id@example.com").click();
await page.getByPlaceholder("id@example.com").fill(EMAIL);
await page.locator("#password").click();
await page.locator("#password").fill(PASSWORD);
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Login" }).click();
try {
  await page.waitForURL("**/dashboard", { timeout: 90000 });
} catch {
  await page.screenshot({ path: "screenshots/login-debug.png", fullPage: true });
  const bodyText = await page.locator("body").innerText().catch(() => "");
  console.log("   LOGIN did not reach /dashboard. url:", page.url());
  console.log("   page text:", bodyText.slice(0, 500));
  await browser.close();
  process.exit(2);
}
console.log("   logged in, url:", page.url());

console.log("2) go to evaluate");
await page.goto(BASE + "/dashboard/evaluate", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Load sample JD" }).waitFor({ state: "visible", timeout: 60000 });
await page.waitForTimeout(2500); // hydrate so the button onClick handlers are attached
await page.getByRole("button", { name: "Load sample JD" }).click();
await page.waitForFunction(() => {
  const ta = document.querySelector("#jd-text");
  return ta && ta.value && ta.value.length > 20;
}, { timeout: 10000 });
const jdLen = await page.locator("#jd-text").inputValue();
console.log("   JD length:", jdLen.length);

console.log("3) click Evaluate only");
await page.getByRole("button", { name: "Evaluate only" }).click();

// wait for the api/evaluate response
const start = Date.now();
while (!evalResp && Date.now() - start < 60000) {
  await page.waitForTimeout(500);
}

console.log("4) /api/evaluate response:", JSON.stringify(evalResp, null, 2));

// capture any toast text
await page.waitForTimeout(1500);
const toastText = await page.locator("[role='status'], li[role='status'], .toast, [data-radix-toast-root]").allInnerTexts().catch(() => []);
console.log("5) toast text:", JSON.stringify(toastText));

await page.screenshot({ path: "screenshots/ai-evaluate-result.png", fullPage: true });
console.log("   screenshot saved -> screenshots/ai-evaluate-result.png");

await browser.close();
