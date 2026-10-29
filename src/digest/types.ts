export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: Record<RunStatus, number>;
};

// Null means the night has no file or the name is not YYYY-MM-DD.
// Other filesystem errors propagate to the caller.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
