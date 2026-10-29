import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('digest routes', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('serves matching HTML and JSON rows and counts malformed lines', async () => {
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'zeta <night>', status: 'retry', owner: 'Rae & Co' }),
        'not json',
        JSON.stringify({ at: '2026-10-28T02:00:00+01:00', job: 'alpha', status: 'fail', owner: null, error: '<timeout>' }),
        JSON.stringify({ at: '2026-10-28T01:01:00+01:00', job: 'zeta <night>', status: 'retry', owner: 'Rae & Co' }),
        JSON.stringify({ at: '2026-10-28T01:02:00+01:00', job: 'zeta <night>', status: 'retry', owner: 'Rae & Co' }),
      ].join('\n'),
    );
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    const [jsonResponse, htmlResponse] = await Promise.all([
      app.request('/api/digest/2026-10-28'),
      app.request('/digest/2026-10-28'),
    ]);

    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.headers.get('content-type')).toContain('application/json');
    expect(await jsonResponse.json()).toEqual({
      night: '2026-10-28',
      rows: [
        {
          job: 'alpha', owner: null, runs: 1, retries: 0,
          lastStatus: 'fail', lastError: '<timeout>',
          firstAt: '2026-10-28T02:00:00+01:00', lastAt: '2026-10-28T02:00:00+01:00',
        },
        {
          job: 'zeta <night>', owner: 'Rae & Co', runs: 3, retries: 3,
          lastStatus: 'retry', lastError: null,
          firstAt: '2026-10-28T01:00:00+01:00', lastAt: '2026-10-28T01:02:00+01:00',
        },
      ],
      badLines: 1,
      counts: { ok: 0, retry: 3, fail: 1 },
    });

    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get('content-type')).toContain('text/html');
    const html = await htmlResponse.text();
    expect(html).toContain('malformed lines 1');
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T01:00:00+01:00');
    expect(html).toContain('2026-10-28T01:02:00+01:00');
    expect(html).toContain('zeta &lt;night&gt;');
    expect(html).toContain('Rae &amp; Co');
    expect(html).toContain('&lt;timeout&gt;');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta &lt;night&gt;'));
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).not.toContain('<timeout>');
  });

  it('returns an empty digest for an empty night file', async () => {
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    const response = await app.request('/api/digest/2026-10-28');
    const htmlResponse = await app.request('/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
  });

  it('returns 404 when the night name is invalid or the file is missing', async () => {
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    expect((await app.request('/api/digest/not-a-night')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/digest/not-a-night')).status).toBe(404);
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
  });
});
