import { it, expect } from '@effect/vitest';
import { Schema } from 'effect';
import * as Event from '../src/Event.js';
import * as Envelope from '../src/Envelope.js';

// ── Minimal Event definition ────────────────────────────────────────

const TestEvent = Event.make({
  tag: 'test.event',
  payload: Schema.String,
});

// ═════════════════════════════════════════════════════════════════════
// Envelope.make tests
// ═════════════════════════════════════════════════════════════════════

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

it('Envelope.make creates an envelope with id, ts, event, payload', () => {
  const envelope = Envelope.make({ event: TestEvent, payload: 'test' });
  expect(envelope.id).toBeDefined();
  expect(typeof envelope.id).toBe('string');
  expect(envelope.id.length).toBeGreaterThan(0);
  expect(envelope.ts).toBeDefined();
  expect(typeof envelope.ts).toBe('number');
  expect(envelope.event).toBe(TestEvent);
  expect(envelope.payload).toBe('test');
});

it('Envelope id is a valid UUID v4', () => {
  const envelope = Envelope.make({ event: TestEvent, payload: 'test' });
  expect(envelope.id).toMatch(uuidV4Regex);
});

it('Envelope id is unique across multiple envelopes', () => {
  const a = Envelope.make({ event: TestEvent, payload: 'test' });
  const b = Envelope.make({ event: TestEvent, payload: 'test' });
  expect(a.id).not.toBe(b.id);
});

// ═════════════════════════════════════════════════════════════════════
// Envelope.isEnvelope type guard tests
// ═════════════════════════════════════════════════════════════════════

it('Envelope.isEnvelope returns true for Envelope objects, false for plain objects', () => {
  const envelope = Envelope.make({ event: TestEvent, payload: 'test' });
  expect(Envelope.isEnvelope(envelope)).toBe(true);
  expect(Envelope.isEnvelope({ id: 'fake' })).toBe(false);
  expect(Envelope.isEnvelope(null)).toBe(false);
  expect(Envelope.isEnvelope(undefined)).toBe(false);
});
