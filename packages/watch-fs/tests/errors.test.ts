import { describe, it, expect } from 'vitest';
import {
  WatchLimitReached,
  WatchPermissionDenied,
  WatchPathNotFound,
  WatchUnknownError,
} from '../src/index.js';
import { toWatchError } from '../src/errors.js';

describe('toWatchError', () => {
  it('maps ENOSPC to WatchLimitReached', () => {
    const err = new Error('no space left');
    (err as any).code = 'ENOSPC';
    expect(toWatchError(err)).toBeInstanceOf(WatchLimitReached);
  });

  it('maps EMFILE to WatchLimitReached', () => {
    const err = new Error('too many files');
    (err as any).code = 'EMFILE';
    expect(toWatchError(err)).toBeInstanceOf(WatchLimitReached);
  });

  it('maps EACCES to WatchPermissionDenied', () => {
    const err = new Error('permission denied');
    (err as any).code = 'EACCES';
    expect(toWatchError(err)).toBeInstanceOf(WatchPermissionDenied);
  });

  it('maps EPERM to WatchPermissionDenied', () => {
    const err = new Error('operation not permitted');
    (err as any).code = 'EPERM';
    expect(toWatchError(err)).toBeInstanceOf(WatchPermissionDenied);
  });

  it('maps ENOENT to WatchPathNotFound', () => {
    const err = new Error('no such file');
    (err as any).code = 'ENOENT';
    expect(toWatchError(err)).toBeInstanceOf(WatchPathNotFound);
  });

  it('maps unknown system errors to WatchUnknownError', () => {
    const err = new Error('something else');
    (err as any).code = 'EXDEV';
    expect(toWatchError(err)).toBeInstanceOf(WatchUnknownError);
  });

  it('maps non-Error values to WatchUnknownError', () => {
    const result = toWatchError('string error');
    expect(result).toBeInstanceOf(WatchUnknownError);
    expect(result.message).toBe('string error');
  });

  it('preserves cause on mapped errors', () => {
    const original = new Error('ENOENT');
    (original as any).code = 'ENOENT';
    const mapped = toWatchError(original) as WatchPathNotFound;
    expect(mapped.cause).toBe(original);
  });
});
