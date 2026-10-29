import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  let runsDir: string;
  beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-reader-')); });
  afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

  it('summarizes the real night without dropping malformed lines or unknown owners', () => {
    expect(readNight(resolve('runs'), '2026-10-28')).toEqual({
      night: '2026-10-28',
      badLines: 1,
      counts: { ok: 10, retry: 4, fail: 1 },
      rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
      ],
    });
  });

  it('returns null for a missing file and an empty digest for an empty file', () => {
    expect(readNight(runsDir, '2026-10-28')).toBeNull();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    expect(readNight(runsDir, '2026-10-28')).toEqual({
      night: '2026-10-28', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('rejects path traversal before reading a file', () => {
    mkdirSync(join(runsDir, 'nested'));
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    expect(readNight(join(runsDir, 'nested'), '../2026-10-28')).toBeNull();
  });

  it('counts invalid records and continues through CRLF and blank lines', () => {
    const event = { at: '2026-10-28T21:00:00-04:00', job: 'sync', status: 'retry', owner: 'rook', error: 'first error' };
    const records = [
      JSON.stringify(event),
      'broken json',
      '',
      'null',
      '[]',
      JSON.stringify({ ...event, at: '0' }),
      JSON.stringify({ ...event, at: 'not a time' }),
      JSON.stringify({ ...event, job: ' ' }),
      JSON.stringify({ ...event, status: 'pending' }),
      JSON.stringify({ ...event, owner: undefined }),
      JSON.stringify({ ...event, owner: 7 }),
      JSON.stringify({ ...event, error: null }),
      JSON.stringify({ ...event, error: 'latest error' }),
      JSON.stringify({ ...event, at: '2026-10-28T21:01:00-04:00', status: 'ok', owner: null, error: undefined }),
    ];
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), records.join('\r\n') + '\r\n');
    expect(readNight(runsDir, '2026-10-28')).toEqual({
      night: '2026-10-28', badLines: 11, counts: { ok: 1, retry: 2, fail: 0 },
      rows: [{ job: 'sync', owner: null, runs: 3, retries: 2, lastStatus: 'ok', lastError: 'latest error',
        firstAt: '2026-10-28T21:00:00-04:00', lastAt: '2026-10-28T21:01:00-04:00' }],
    });
  });

  it('propagates filesystem errors other than a missing file', () => {
    mkdirSync(join(runsDir, '2026-10-28.jsonl'));
    expect(() => readNight(runsDir, '2026-10-28')).toThrow(expect.objectContaining({ code: 'EISDIR' }));
  });
});
