# @effect-pantry/events

A type-safe, in-memory event bus for Effect-TS. It features branded event definitions backed by Effect's powerful `PubSub` queues.

## Features

* **Fully Type-Safe:** Infers payload types directly from your schemas.
* **Schema Agnostic:** Supports Effect's `Schema` module or any schema matching the `@standard-schema/spec` (Zod, Valibot, ArkType).
* **PubSub Backed:** Built on standard Effect Streams and Queues.

---

## 1. Defining Events

Events are defined using `Event.make`. This binds a unique string tag to a specific payload schema.

```typescript
import { Event } from '@effect-pantry/events';
import { Schema } from 'effect';

export const UserCreated = Event.make({
  tag: 'UserCreated',
  payload: Schema.Struct({
    userId: Schema.String,
    email: Schema.String
  })
});

export const SystemStarted = Event.make({
  tag: 'SystemStarted'
  // payload is automatically inferred as Schema.Void if omitted
});

```

### Event Options

When calling `Event.make(options)`, the options object accepts:

| Property | Type | Description |
| --- | --- | --- |
| **`tag`** | `string` | **Required.** A unique string identifier for the event (e.g., `'UserCreated'`). |
| **`payload`** | `AnyPayload` | **Optional.** The schema for the event's payload data. Defaults to `Schema.Void` (meaning no payload is expected). Accepts `@effect/schema` or any `@standard-schema/spec` compliant schema. |

---

## 2. Providing the Event Bus

Before you can publish or subscribe, you must provide the `EventBus` layer to your Effect program.

```typescript
import { EventBus } from '@effect-pantry/events';
import { Effect } from 'effect';

const program = Effect.gen(function* () {
  // Your app logic here
});

// Provide with default options (unbounded queue)
const runnable1 = Effect.provide(program, EventBus.layer());

// Provide with a bounded capacity
const runnable2 = Effect.provide(program, EventBus.layer({ capacity: 1000 }));

```

### EventBus Options

When calling `EventBus.layer(options)` or `EventBus.make(options)`, the `MakeOptions` object accepts:

| Property | Type | Description |
| --- | --- | --- |
| **`capacity`** | `number` | **Optional.** Defines the maximum number of events the internal `PubSub` queue can hold before applying backpressure. If omitted, the bus creates an **unbounded** queue (infinite capacity). |

> **Note on Capacity:** If you set a `capacity`, publishers will be suspended (blocked) if the queue is full until subscribers process the pending events. If left unbounded, publishers will never block, but memory usage will grow if subscribers process events slower than they are published.

---

## 3. Publishing Events

Use `EventBus.publish` to emit an event. The payload must strictly match the schema you defined in `Event.make`.

```typescript
import { EventBus } from '@effect-pantry/events';
import { Effect } from 'effect';

const publishUser = Effect.gen(function* () {
  // Typescript will enforce that payload matches the UserCreated schema
  yield* EventBus.publish(UserCreated, {
    userId: 'usr_123',
    email: 'test@example.com'
  });
});

```

### Optional Publishing

If you are building a library or module where the EventBus is strictly optional, you can use `publishOptional`. If the `EventBus` service is not provided to the runtime, this will safely do nothing and return `false` instead of failing with an `EventBusNotFoundError`.

```typescript
yield* EventBus.publishOptional(UserCreated, { userId: '123', email: 'test@example.com' });

```

---

## 4. Subscribing to Events

`EventBus.subscribe` returns an Effect `Stream`. You can consume this stream to react to incoming events. The stream yields an `Envelope`, which wraps your event with metadata (like an `id` and `ts` timestamp).

```typescript
import { EventBus } from '@effect-pantry/events';
import { Effect, Stream } from 'effect';

const handleNewUsers = Effect.gen(function* () {
  const stream = yield* EventBus.subscribe(UserCreated);
  
  yield* Stream.runForEach(stream, (envelope) => Effect.gen(function* () {
    // Type-safe payload access:
    console.log(`Processing user: ${envelope.payload.userId}`);
    
    // Metadata access:
    console.log(`Event timestamp: ${envelope.ts}`);
  }));
});

```

### The Envelope API

Every emitted event is wrapped in an `Envelope` object:

* **`id`** (`string`): A unique UUID generated when the event was published.
* **`ts`** (`number`): The exact timestamp (`Date.now()`) when the event was published.
* **`event`** (`Event`): The event definition itself.
* **`payload`** (`InferPayload`): The payload data.