import { describe, it, expect } from "vitest";
import {
  ImageFormatError,
  ImageDecodeError,
  ImageEncodeError,
  ImageTransformError,
  ImageAdapterError,
  UnsupportedOpError,
  toImageError,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Instantiation and _tag checks
// ---------------------------------------------------------------------------

describe("ImageFormatError", () => {
  it("can be instantiated with message and cause", () => {
    const cause = new Error("underlying format error");
    const err = new ImageFormatError({
      message: "unsupported format: bmp",
      cause,
    });

    expect(err._tag).toBe("ImageFormatError");
    expect(err.message).toBe("unsupported format: bmp");
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error and ImageFormatError", () => {
    const err = new ImageFormatError({
      message: "bad format",
      cause: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageFormatError);
  });
});

describe("ImageDecodeError", () => {
  it("can be instantiated with message and cause", () => {
    const cause = new Error("corrupt header");
    const err = new ImageDecodeError({
      message: "failed to decode image",
      cause,
    });

    expect(err._tag).toBe("ImageDecodeError");
    expect(err.message).toBe("failed to decode image");
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error and ImageDecodeError", () => {
    const err = new ImageDecodeError({
      message: "decode error",
      cause: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageDecodeError);
  });
});

describe("ImageEncodeError", () => {
  it("can be instantiated with message and cause", () => {
    const cause = new Error("encoder panic");
    const err = new ImageEncodeError({
      message: "failed to encode to webp",
      cause,
    });

    expect(err._tag).toBe("ImageEncodeError");
    expect(err.message).toBe("failed to encode to webp");
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error and ImageEncodeError", () => {
    const err = new ImageEncodeError({
      message: "encode error",
      cause: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageEncodeError);
  });
});

describe("ImageTransformError", () => {
  it("can be instantiated with message and cause", () => {
    const cause = new Error("invalid dimensions");
    const err = new ImageTransformError({
      message: "resize failed",
      cause,
    });

    expect(err._tag).toBe("ImageTransformError");
    expect(err.message).toBe("resize failed");
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error and ImageTransformError", () => {
    const err = new ImageTransformError({
      message: "transform error",
      cause: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageTransformError);
  });
});

describe("ImageAdapterError", () => {
  it("can be instantiated with message and cause", () => {
    const cause = new Error("network timeout");
    const err = new ImageAdapterError({
      message: "adapter I/O failure",
      cause,
    });

    expect(err._tag).toBe("ImageAdapterError");
    expect(err.message).toBe("adapter I/O failure");
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error and ImageAdapterError", () => {
    const err = new ImageAdapterError({
      message: "adapter error",
      cause: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageAdapterError);
  });
});

describe("UnsupportedOpError", () => {
  it("can be instantiated with message and op name", () => {
    const err = new UnsupportedOpError({
      message: 'Operation "blur" is not supported',
      op: "blur",
    });

    expect(err._tag).toBe("UnsupportedOpError");
    expect(err.message).toBe('Operation "blur" is not supported');
    expect(err.op).toBe("blur");
  });

  it("is an instance of Error and UnsupportedOpError", () => {
    const err = new UnsupportedOpError({
      message: "unsupported",
      op: "negate",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UnsupportedOpError);
  });

  it("carries the operation name independently of the message", () => {
    const err = new UnsupportedOpError({
      message: "this op is not available",
      op: "crop",
    });

    expect(err.op).toBe("crop");
    expect(err.message).not.toBe(err.op);
  });
});

// ---------------------------------------------------------------------------
// ImageError union — cover all variants via instanceof
// ---------------------------------------------------------------------------

describe("ImageError union", () => {
  it("ImageFormatError matches via instanceof", () => {
    const err = new ImageFormatError({ message: "x", cause: null });
    expect(err).toBeInstanceOf(ImageFormatError);
  });

  it("ImageDecodeError matches via instanceof", () => {
    const err = new ImageDecodeError({ message: "x", cause: null });
    expect(err).toBeInstanceOf(ImageDecodeError);
  });

  it("ImageEncodeError matches via instanceof", () => {
    const err = new ImageEncodeError({ message: "x", cause: null });
    expect(err).toBeInstanceOf(ImageEncodeError);
  });

  it("ImageTransformError matches via instanceof", () => {
    const err = new ImageTransformError({ message: "x", cause: null });
    expect(err).toBeInstanceOf(ImageTransformError);
  });

  it("ImageAdapterError matches via instanceof", () => {
    const err = new ImageAdapterError({ message: "x", cause: null });
    expect(err).toBeInstanceOf(ImageAdapterError);
  });

  it("UnsupportedOpError matches via instanceof", () => {
    const err = new UnsupportedOpError({ message: "x", op: "resize" });
    expect(err).toBeInstanceOf(UnsupportedOpError);
  });
});

// ---------------------------------------------------------------------------
// toImageError — wrapping unknown errors
// ---------------------------------------------------------------------------

describe("toImageError", () => {
  it("returns the same instance if already an ImageFormatError", () => {
    const original = new ImageFormatError({ message: "bad", cause: null });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("returns the same instance if already an ImageDecodeError", () => {
    const original = new ImageDecodeError({ message: "bad", cause: null });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("returns the same instance if already an ImageEncodeError", () => {
    const original = new ImageEncodeError({ message: "bad", cause: null });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("returns the same instance if already an ImageTransformError", () => {
    const original = new ImageTransformError({ message: "bad", cause: null });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("returns the same instance if already an ImageAdapterError", () => {
    const original = new ImageAdapterError({ message: "bad", cause: null });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("returns the same instance if already an UnsupportedOpError", () => {
    const original = new UnsupportedOpError({
      message: "bad",
      op: "resize",
    });
    const result = toImageError(original);
    expect(result).toBe(original);
  });

  it("wraps a plain Error into ImageAdapterError", () => {
    const cause = new Error("something broke");
    const result = toImageError(cause);

    expect(result).toBeInstanceOf(ImageAdapterError);
    expect(result._tag).toBe("ImageAdapterError");
    expect(result.message).toBe("something broke");
    expect(result.cause).toBe(cause);
  });

  it("wraps a string into ImageAdapterError", () => {
    const result = toImageError("raw string error");

    expect(result).toBeInstanceOf(ImageAdapterError);
    expect(result._tag).toBe("ImageAdapterError");
    expect(result.message).toBe("raw string error");
    expect(result.cause).toBe("raw string error");
  });

  it("wraps null into ImageAdapterError", () => {
    const result = toImageError(null);

    expect(result).toBeInstanceOf(ImageAdapterError);
    expect(result._tag).toBe("ImageAdapterError");
    expect(result.message).toBe("null");
    expect(result.cause).toBe(null);
  });

  it("wraps an object into ImageAdapterError with toString message", () => {
    const obj = { code: "BOOM" };
    const result = toImageError(obj);

    expect(result).toBeInstanceOf(ImageAdapterError);
    expect(result._tag).toBe("ImageAdapterError");
    expect(result.message).toBe(String(obj));
    expect(result.cause).toBe(obj);
  });
});
