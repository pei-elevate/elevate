import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

const styles = new URL('../src/app/styles/', import.meta.url);
const css = (name) => readFile(new URL(`${name}.css`, styles), 'utf8');

test('motion tokens and button press feedback', async () => {
  const base = await css('base');
  assert.match(base, /--ease-out:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/);
  assert.match(base, /--dur-press:\s*100ms/);
  assert.match(base, /--dur-fast:\s*150ms/);
  assert.match(base, /--dur-base:\s*200ms/);
  assert.match(base, /--dur-exit:\s*160ms/);
  assert.match(base, /--stagger:\s*30ms/);

  const ui = await css('ui');
  assert.match(ui, /\.button:active[^}]*scale\(0\.97\)/);
  assert.match(ui, /\.text-button:active[^}]*scale\(0\.97\)/);
  assert.match(ui, /\.text-button:active(?::not\(:disabled\))?\s*\{[^}]*transition:\s*none/);
  assert.match(ui, /\.button\s*\{[^}]*transition:[^;]*var\(--dur-fast\)/);
});

test('dialog animates in and out', async () => {
  const dialogs = await css('dialogs');
  assert.match(dialogs, /@starting-style/);
  assert.match(dialogs, /transition-behavior:\s*allow-discrete/);
  assert.match(dialogs, /scale\(0\.95\)/);
  assert.match(dialogs, /dialog\[open\]/);
  assert.match(dialogs, /dialog\s*\{[^}]*var\(--dur-exit\)/);
  assert.match(dialogs, /dialog\[open\]\s*\{[^}]*var\(--dur-base\)/);
  assert.match(dialogs, /dialog\s*\{[^}]*display var\(--dur-exit\) allow-discrete/);
});

test('mobile sidebar slides and scrim fades', async () => {
  const responsive = await css('responsive');
  const mobile = responsive.slice(responsive.indexOf('@media (max-width: 900px)'));
  const sidebar = mobile.match(/\n\s*\.sidebar\s*\{([^}]*)\}/)[1];
  assert.match(sidebar, /visibility:\s*hidden/);
  assert.doesNotMatch(sidebar, /display:\s*none/);
  assert.match(sidebar, /transition:[^;]*transform var\(--dur-base\) var\(--ease-out\)/);
  assert.match(mobile, /\.sidebar\.open\s*\{[^}]*visibility:\s*visible/);
  const scrim = mobile.match(/\n\s*\.scrim\s*\{([^}]*)\}/)[1];
  assert.match(scrim, /animation:[^;]*var\(--dur-fast\)/);
  assert.match(responsive, /animation: none !important/);
});

test('rows stagger and feedback banner enters', async () => {
  const ui = await css('ui');
  assert.match(ui, /@keyframes row-in/);
  assert.match(ui, /tbody tr\s*\{[^}]*animation:[^;]*row-in var\(--dur-base\) var\(--ease-out\)/);
  assert.match(ui, /tbody tr\s*\{[^}]*row-in[^;]*backwards/);
  for (let n = 1; n <= 10; n += 1) {
    const rule = new RegExp(
      `tbody tr:nth-child\\(${n}\\)\\s*\\{[^}]*animation-delay:\\s*calc\\(\\(${n} - 1\\) \\* var\\(--stagger\\)\\)`,
    );
    assert.match(ui, rule);
  }
  assert.doesNotMatch(ui, /nth-child\(11\)/);

  const dialogs = await css('dialogs');
  assert.match(dialogs, /@keyframes feedback-in/);
  assert.match(dialogs, /\.feedback\s*\{[^}]*animation:[^;]*feedback-in/);
});

test('page enters with a fade and slide', async () => {
  const shell = await css('shell');
  assert.match(shell, /@keyframes page-in/);
  assert.match(shell, /main\s*\{[^}]*animation:\s*page-in var\(--dur-base\) var\(--ease-out\)/);
  assert.match(shell, /translateY\(6px\)/);
  assert.doesNotMatch(shell, /main\s*\{[^}]*page-in[^;]*(forwards|both)/);

  const forms = await css('forms');
  assert.match(forms, /@keyframes fade-in/);
  assert.match(
    forms,
    /\.form-container\s*\{[^}]*animation:\s*fade-in var\(--dur-base\) var\(--ease-out\)/,
  );
});
