# @effect-pantry/events

A type-safe, in-memory event bus for Effect-TS v3. Define events with branded tags and inferred payload types, then publish/subscribe — all within the Effect runtime.

## Features

- **Fully type-safe** — payload types are inferred from your schemas; the compiler catches mismatches
- **Schema-agnostic** — accepts `@effect/schema` or any library implementing the `@standard-schema/spec` interface (Zod, Valibot, ArkType)
- **Schema is for inference, not validation** — schemas are used solely to derive TypeScript types; no runtime validation is performed
- **Pluggable bus** — `EventBus` is a `Context.Tag`; the default implementation uses in-memory `PubSub`, but you can swap in your own
- **Composable** — build custom buses on top of the default one (e.g., record every event, add transforms, bridge to external systems)

## Installation

```bash
npm install @effect-pantry/events effect
```

This package targets **Effect v3**. Not compatible with v4.

---

## Basic Usage

Define an event, provide the default `EventBus`, then publish and subscribe.

```ts
import { Event, EventBus } from "@effect-pantry/events"
import { Effect, Schema, Stream } from "effect"

// 1. Define an event
const UserCreated = Event.make({
  tag: "UserCreated",
  payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
})

// 2. Provide the default in-memory bus
const layer = EventBus.layer()

// 3. Subscribe and publish
const program = Effect.gen(function* () {
  const stream = EventBus.subscribe(UserCreated)
  const fiber = yield* Effect.fork(
    Stream.runForEach(stream, (envelope) =>
      Effect.log(`User ${envelope.payload.name} created`),
    ),
  )
  yield* EventBus.publish(UserCreated, { id: "1", name: "Alice" })
  yield* Fiber.join(fiber)
})

Effect.runPromise(Effect.provide(program, layer))
```

---

## Events

### Defining Events

Call `Event.make` with a `tag` string and an optional `payload` schema. The schema is used **only for type inference**.

```ts
import { Event } from "@effect-pantry/events"
import { Schema } from "effect"

// With a payload schema
const OrderPlaced = Event.make({
  tag: "OrderPlaced",
  payload: Schema.Struct({
    orderId: Schema.String,
    amount: Schema.Number,
  }),
})

// Without a payload (defaults to Schema.Void)
const SystemStarted = Event.make({ tag: "SystemStarted" })
```

> **The `tag` must be system-wide unique.** It is the primary identifier used to route events between publishers and subscribers. Two events with the same tag will share subscribers.

| Option       | Type         | Description                                                     |
| ------------ | ------------ | --------------------------------------------------------------- |
| **`tag`**    | `string`     | **Required.** System-wide unique identifier for the event.       |
| **`payload`** | `AnyPayload` | **Optional.** Schema for type inference. Defaults to `Schema.Void`. |

`AnyPayload` accepts `@effect/schema` or any `StandardSchemaV1`-compatible library (Zod, Valibot, ArkType, etc.).

### Type Guards

```ts
import { Event } from "@effect-pantry/events"

Event.isEvent(UserCreated)   // true
Event.isEvent({ tag: "x" })  // false
```

---

## The EventBus

`EventBus` is a **`Context.Tag`** — a contract, not a concrete implementation. The default implementation ships with the package, but you can swap it out, or build on top of it, just by providing a different service.

### Default Implementation

The default bus is backed by Effect's in-memory `PubSub`. Publish pushes an event onto the bus; subscribe returns a `Stream` filtered by event tag.

#### Providing the Bus

An **unbounded** queue is recommended for most use cases.

```ts
import { EventBus } from "@effect-pantry/events"

const layer = EventBus.layer()
Effect.provide(myProgram, layer)
```

> **Bounded queues are not recommended.** When you set a `capacity`, publishers will be suspended if the queue fills up, waiting for subscribers to drain it. This can lead to deadlocks in programs where publishing and subscribing happen within the same fiber, or introduce hard-to-debug backpressure. Prefer the default unbounded queue unless you have a specific need to limit memory usage.

If you do need a bounded queue:

```ts
const boundedLayer = EventBus.layer({ capacity: 256 })
```

#### Publishing

```ts
const run = Effect.gen(function* () {
  const ok = yield* EventBus.publish(OrderPlaced, {
    orderId: "ord_001",
    amount: 2999,
  })
  // ok: boolean
})
```

If the bus isn't in context, `publish` fails with `EventBusNotFoundError`.

#### Subscribing

`EventBus.subscribe` returns a `Stream` of `Envelope` objects. Subscriptions filter by event tag — publishing a different event type won't trigger the wrong subscriber.

```ts
const run = Effect.gen(function* () {
  const stream = EventBus.subscribe(OrderPlaced)

  yield* Stream.runForEach(stream, (envelope) =>
    Effect.log(`Order ${envelope.payload.orderId} — $${envelope.payload.amount}`),
  )
})
```

#### The Envelope

Every published event is wrapped in an `Envelope`:

| Field       | Type     | Description                                      |
| ----------- | -------- | ------------------------------------------------ |
| **`id`**    | `string` | UUID v4 generated at publish time.               |
| **`ts`**    | `number` | Unix timestamp in milliseconds.                  |
| **`event`** | `Event`  | The event definition that was published.          |
| **`payload`** | (inferred) | The type-safe payload data.                  |

#### Error Handling

When the `EventBus` service isn't provided, operations fail with `EventBusNotFoundError`:

```ts
import { EventBus, EventBusNotFoundError } from "@effect-pantry/events"

const result = yield* Effect.either(
  EventBus.publish(OrderPlaced, { orderId: "1", amount: 99 }),
)
// Left(EventBusNotFoundError): "EventBus service not provided..."
```

#### Optional Access

When the bus is truly optional, use the `Optional` variants — they return `Option` instead of failing:

```ts
// Returns Option<boolean> — none if bus isn't provided
const result = yield* EventBus.publishOptional(OrderPlaced, {
  orderId: "1",
  amount: 99,
})

// Returns Option<Stream>
const stream = yield* EventBus.subscribeOptional(OrderPlaced)
```

### Custom Implementations

Because `EventBus` is just a `Context.Tag`, you can implement your own bus and provide it instead. The interface you need to satisfy is:

```ts
{
  readonly publish: <TEvent extends Event.AnyEvent>(
    event: TEvent,
    payload: TEvent[typeof Event.MetaTypeId]['inferPayload'],
  ) => Effect.Effect<boolean>

  readonly subscribe: <TEvent extends Event.AnyEvent>(
    event: TEvent,
  ) => Stream.Stream<Envelope.Envelope<TEvent>, never>

  readonly unsafePublish: <TEvent extends Event.AnyEvent>(
    event: TEvent,
    payload: TEvent[typeof Event.MetaTypeId]['inferPayload'],
  ) => boolean
}
```

You can build on top of the default bus using `EventBus.make()` and add side effects without changing the shape:

```ts
import { EventBus, Envelope } from "@effect-pantry/events"
import { Effect, Layer } from "effect"

const makeLoggingBus = Effect.gen(function* () {
  const bus = yield* EventBus.make() // the default in-memory bus

  return EventBus.of({
    publish: (event, payload) =>
      Effect.gen(function* () {
        yield* Effect.log(`[event] ${event.tag}`, payload)
        return yield* bus.publish(event, payload)
      }),
    subscribe: (event) => bus.subscribe(event),
    unsafePublish: (event, payload) => {
      console.log(`[event] ${event.tag}`)
      return bus.unsafePublish(event, payload)
    },
  })
})

const LoggingBusLayer = Layer.effect(EventBus, makeLoggingBus)
```

For cross-cutting concerns that need their own interface, define a separate `Context.Tag`. For example, a recorder that stores every published event:

```ts
import { EventBus, Envelope } from "@effect-pantry/events"
import { Context, Effect, Layer, Ref } from "effect"

class Recorder extends Context.Tag("Recorder")<
  Recorder,
  {
    readonly push: (envelope: Envelope.Envelope<any>) => Effect.Effect<void>
    readonly all: () => Effect.Effect<Array<Envelope.Envelope<any>>>
  }
>() {}

const RecorderLive = Layer.effect(
  Recorder,
  Effect.gen(function* () {
    const ref = yield* Ref.make<Array<Envelope.Envelope<any>>>([])
    return Recorder.of({
      push: (envelope) => Ref.update(ref, (history) => [...history, envelope]),
      all: () => Ref.get(ref),
    })
  }),
)

// Build a bus that records via the Recorder tag
const makeRecordingBus = Effect.gen(function* () {
  const bus = yield* EventBus.make()
  const recorder = yield* Recorder

  return EventBus.of({
    publish: (event, payload) =>
      Effect.gen(function* () {
        const envelope = Envelope.make({ event, payload })
        yield* recorder.push(envelope)
        return yield* bus.publish(event, payload)
      }),
    subscribe: (event) => bus.subscribe(event),
    unsafePublish: (event, payload) => bus.unsafePublish(event, payload),
  })
})

const RecordingBusLayer = Layer.effect(EventBus, makeRecordingBus)

// Provide all layers
const program = Effect.provide(myProgram, RecordingBusLayer)
  .pipe(Effect.provide(RecorderLive))
```

---

## API Reference

### `Event`

| Export          | Description                                |
| --------------- | ------------------------------------------ |
| `Event.make(options)` | Create an event definition with `tag` and optional `payload`. |
| `Event.isEvent(u)`    | Runtime type guard. Returns `true` for Event instances. |
| `Event.MetaTypeId`    | Symbol key for accessing system-level event metadata (`EventMeta`). |
| `Event.EventMeta<Payload>` | Container for system-level type information (e.g. `inferPayload`). |

### `EventBus`

| Export                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `EventBus`                | `Context.Tag` — the contract. Inject with `yield* EventBus`. |
| `EventBus.publish(event, payload)`  | Publish. Fails with `EventBusNotFoundError` if bus absent. |
| `EventBus.subscribe(event)` | Subscribe. Returns `Stream<Envelope>`.                    |
| `EventBus.publishOptional(event, payload)` | Non-failing publish. Returns `Option<boolean>`. |
| `EventBus.subscribeOptional(event)` | Non-failing subscribe. Returns `Option<Stream>`.       |
| `EventBus.layer(options?)` | Create a `Layer` providing the default in-memory bus. |
| `EventBus.make(options?)`  | Create the default bus directly (returns `Effect<EventBus>`). |

### `Envelope`

| Export                | Description                              |
| --------------------- | ---------------------------------------- |
| `Envelope.make({ event, payload })` | Create an envelope (generates UUID + timestamp). |
| `Envelope.isEnvelope(u)` | Runtime type guard.                    |

### Errors

| Export                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `EventBusNotFoundError` | Thrown when EventBus is not in the context.     |

### Symbols

| Export               | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `Event.TypeId`       | Brand symbol for Event instances.                     |
| `Event.MetaTypeId`   | Symbol key for accessing system-level event metadata. |
| `Envelope.TypeId`    | Brand symbol for Envelope instances.                  |

### Types

| Export                    | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `Event<Tag, Payload>`              | Typed event definition.                                     |
| `Event.EventMeta<Payload>`         | System-level event metadata (inferred payload type, etc.). |
| `Envelope<TEvent>`                 | Published event with `id`, `ts`, `event`, and `payload`.    |
| `AnyPayload`                       | `Schema.Schema.Any \| StandardSchemaV1`.                    |
| `InferPayload<Payload>`            | Extracts the output type from a payload schema.             |

## License

MIT
