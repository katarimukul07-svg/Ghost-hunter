export function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export function completeTutorialForMostTests(test) {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes("first launch tutorial")) {
      await page.addInitScript(() => localStorage.setItem("echoSteps.tutorial.v1", "complete"));
    }
  });
}
