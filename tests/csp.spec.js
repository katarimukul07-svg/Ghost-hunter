import {test,expect} from '@playwright/test';
import {completeTutorialForMostTests} from './helpers.js';
completeTutorialForMostTests(test);
test('shipped CSP blocks inline event execution and unapproved script origins',async({page})=>{
 await page.goto('/');
 const meta=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
 expect(meta).toContain("script-src 'self'");expect(meta).not.toContain("script-src 'self' 'unsafe-inline'");
 await page.evaluate(()=>{
  window.cspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.cspViolations.push(event.effectiveDirective));
  const button=document.createElement('button');button.setAttribute('onclick','window.inlineExecuted=true');document.body.append(button);button.click();
  const script=document.createElement('script');script.src='https://attacker.invalid/script.js';document.head.append(script);
 });
 await expect.poll(()=>page.evaluate(()=>window.cspViolations.length)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>window.inlineExecuted)).toBeUndefined();
});
