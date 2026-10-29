import { describe, expect, it } from 'vitest';
import { renderToString } from 'hono/jsx/dom/server';
import { DigestPage } from '../src/views/digest.js';
import type { NightDigest } from '../src/digest/types.js';

describe('digest page', () => {
  it('shows every row field and marks failed or repeatedly retried jobs', () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      badLines: 1,
      counts: { ok: 0, retry: 1, fail: 1 },
      rows: [
        {
          job: 'alpha', owner: null, runs: 4, retries: 3, lastStatus: 'retry',
          lastError: null, firstAt: '2026-10-28T01:00:00+02:00', lastAt: '2026-10-28T01:04:00+02:00',
        },
        {
          job: 'beta', owner: 'Ada', runs: 1, retries: 0, lastStatus: 'fail',
          lastError: 'timeout', firstAt: '2026-10-28T02:00:00+02:00', lastAt: '2026-10-28T02:00:00+02:00',
        },
      ],
    };

    const html = renderToString(<DigestPage digest={digest} />);

    expect(html).toContain('2026-10-28');
    expect(html).toContain('—');
    expect(html).toContain('Ada');
    expect(html).toContain('4');
    expect(html).toContain('timeout');
    expect(html).toContain('2026-10-28T01:00:00+02:00');
    expect(html).toContain('2026-10-28T01:04:00+02:00');
    expect((html.match(/class="warn"/g) ?? []).length).toBe(2);
  });

  it('shows a message when no jobs ran', () => {
    const digest: NightDigest = {
      night: '2026-10-28',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    };

    expect(renderToString(<DigestPage digest={digest} />)).toContain('nothing ran');
  });
});
