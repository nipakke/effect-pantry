import { it, expect } from '@effect/vitest';
import { Schema } from 'effect';
import * as Event from '../src/Event.js';

// ── Inline Event definitions ────────────────────────────────────────

const StringEvent = Event.make({
  tag: 'test.string',
  payload: Schema.String,
});

const VoidEvent = Event.make({ tag: 'test.void' });

// ═════════════════════════════════════════════════════════════════════
// Event.make tests
// ═════════════════════════════════════════════════════════════════════

it('Event.make creates a tagged event definition with correct tag', () => {
  expect(StringEvent.tag).toBe('test.string');
  expect(StringEvent.payload).toBe(Schema.String);
  expect(VoidEvent.payload).toBe(Schema.Void);
});

it('Event.make defaults payload to Schema.Void when omitted', () => {
  expect(VoidEvent.payload).toBe(Schema.Void);
});

it('Event.make with Schema.Struct payload infers the type correctly', () => {
  const UserSchema = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
  });
  const UserCreated = Event.make({
    tag: 'user.created',
    payload: UserSchema,
  });
  expect(UserCreated.tag).toBe('user.created');
  expect(UserCreated.payload).toBeDefined();
  expect(UserCreated.payload).toBe(UserSchema);
});

// ═════════════════════════════════════════════════════════════════════
// Event.isEvent type guard tests
// ═════════════════════════════════════════════════════════════════════

it('Event.isEvent returns true for Event objects, false for plain objects', () => {
  expect(Event.isEvent(StringEvent)).toBe(true);
  expect(Event.isEvent(VoidEvent)).toBe(true);
  expect(Event.isEvent({ tag: 'fake' })).toBe(false);
  expect(Event.isEvent(null)).toBe(false);
  expect(Event.isEvent(undefined)).toBe(false);
  expect(Event.isEvent('string')).toBe(false);
});
