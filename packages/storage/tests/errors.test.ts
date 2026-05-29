import { describe, it, expect, assert } from 'vitest';
import { FilesError } from 'files-sdk';
import {
  StorageNotFoundError,
  StorageUnauthorizedError,
  StorageConflictError,
  StorageProviderError,
  toStorageError,
} from '../src/index.js';

// ═════════════════════════════════════════════════════════════════════
// toStorageError — SDK FilesError instances
// ═════════════════════════════════════════════════════════════════════

describe('toStorageError', () => {
  it('maps FilesError(code="NotFound") to StorageNotFoundError', () => {
    const sdkErr = new FilesError('NotFound', 'memory: not found: missing.txt');
    const result = toStorageError(sdkErr);
    expect(result).toBeInstanceOf(StorageNotFoundError);
    expect(result._tag).toBe('StorageNotFoundError');
    expect(result.message).toBe('memory: not found: missing.txt');
    expect(result.cause).toBeUndefined();
  });

  it('maps FilesError(code="Unauthorized") to StorageUnauthorizedError', () => {
    const cause = new Error('bad token');
    const sdkErr = new FilesError('Unauthorized', 'invalid credentials', cause);
    const result = toStorageError(sdkErr);
    assert.instanceOf(result, StorageUnauthorizedError);
    expect(result._tag).toBe('StorageUnauthorizedError');
    expect(result.message).toBe('invalid credentials');
    expect(result.cause).toBe(cause);
  });

  it('maps FilesError(code="Conflict") to StorageConflictError', () => {
    const sdkErr = new FilesError('Conflict', 'key already exists');
    const result = toStorageError(sdkErr);
    expect(result).toBeInstanceOf(StorageConflictError);
    expect(result._tag).toBe('StorageConflictError');
    expect(result.message).toBe('key already exists');
  });

  it('maps FilesError(code="Provider") to StorageProviderError (non-aborted)', () => {
    const cause = new Error('connection reset');
    const sdkErr = new FilesError('Provider', 'network failure', cause, {
      aborted: false,
    });
    const result = toStorageError(sdkErr);
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('network failure');
    expect(result.cause).toBe(cause);
    expect(result.aborted).toBe(false);
  });

  it('maps FilesError(code="Provider") to StorageProviderError (aborted)', () => {
    const sdkErr = new FilesError('Provider', 'timed out', undefined, {
      aborted: true,
    });
    const result = toStorageError(sdkErr);
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('timed out');
    expect(result.aborted).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════
  // toStorageError — non-FilesError fallback
  // ═══════════════════════════════════════════════════════════════════

  it('maps plain Error to StorageProviderError', () => {
    const err = new Error('something broke');
    const result = toStorageError(err);
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('something broke');
    expect(result.cause).toBe(err);
    expect(result.aborted).toBe(false);
  });

  it('maps string to StorageProviderError', () => {
    const result = toStorageError('raw string error');
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('raw string error');
    expect(result.cause).toBe('raw string error');
    expect(result.aborted).toBe(false);
  });

  it('maps object to StorageProviderError', () => {
    const obj = { code: 'Boom', detail: 'kaboom' };
    const result = toStorageError(obj);
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('[object Object]');
    expect(result.cause).toBe(obj);
    expect(result.aborted).toBe(false);
  });

  it('maps null to StorageProviderError', () => {
    const result = toStorageError(null);
    assert.instanceOf(result, StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('null');
    expect(result.cause).toBe(null);
    expect(result.aborted).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════
  // toStorageError — static FilesError.wrap helper
  // ═══════════════════════════════════════════════════════════════════

  it('maps FilesError.wrap plain Error (defaults to Provider)', () => {
    const sdkErr = FilesError.wrap(new Error('raw'));
    const result = toStorageError(sdkErr);
    expect(result).toBeInstanceOf(StorageProviderError);
    expect(result._tag).toBe('StorageProviderError');
    expect(result.message).toBe('raw');
  });

  it('maps FilesError.wrap with custom code', () => {
    const sdkErr = FilesError.wrap(new Error('missing'), 'NotFound');
    const result = toStorageError(sdkErr);
    expect(result).toBeInstanceOf(StorageNotFoundError);
    expect(result._tag).toBe('StorageNotFoundError');
    expect(result.message).toBe('missing');
  });
});
