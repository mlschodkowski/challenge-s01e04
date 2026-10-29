import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('digest JSON API', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  });

  afterEach(() => {
    rmSync(runsDir, { recursive: true, force: true });
  });

  it('returns the shared digest for a night, including malformed line counts', async () => {
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'zeta', status: 'retry', owner: 'Rae' }),
        'not json',
        JSON.stringify({ at: '2026-10-28T02:00:00+01:00', job: 'alpha', status: 'fail', owner: null, error: 'timeout' }),
      ].join('\n'),
    );
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    const response = await app.request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      night: '2026-10-28',
      rows: [
        {
          job: 'alpha', owner: null, runs: 1, retries: 0,
          lastStatus: 'fail', lastError: 'timeout',
          firstAt: '2026-10-28T02:00:00+01:00', lastAt: '2026-10-28T02:00:00+01:00',
        },
        {
          job: 'zeta', owner: 'Rae', runs: 1, retries: 1,
          lastStatus: 'retry', lastError: null,
          firstAt: '2026-10-28T01:00:00+01:00', lastAt: '2026-10-28T01:00:00+01:00',
        },
      ],
      badLines: 1,
      counts: { ok: 0, retry: 1, fail: 1 },
    });
  });

  it('returns an empty digest for an empty night file', async () => {
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    const response = await app.request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('returns 404 when the night name is invalid or the file is missing', async () => {
    const app = createApp({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir });

    expect((await app.request('/api/digest/not-a-night')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });
});
