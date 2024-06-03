const enosys = () => {
  const err = new Error("not implemented");
  err.code = "ENOSYS";
  return err;
};

let fs = globalThis.fs;
if (!fs) {
  let outputBuf = "";
  fs = {
    constants: {
      O_WRONLY: -1,
      O_RDWR: -1,
      O_CREAT: -1,
      O_TRUNC: -1,
      O_APPEND: -1,
      O_EXCL: -1,
    }, // unused
    writeSync(fd, buf) {
      outputBuf += decoder.decode(buf);
      const nl = outputBuf.lastIndexOf("\n");
      if (nl != -1) {
        console.log(outputBuf.substring(0, nl));
        outputBuf = outputBuf.substring(nl + 1);
      }
      return buf.length;
    },
    write(fd, buf, offset, length, position, callback) {
      if (offset !== 0 || length !== buf.length || position !== null) {
        callback(enosys());
        return;
      }
      const n = this.writeSync(fd, buf);
      callback(null, n);
    },
    chmod(path, mode, callback) {
      callback(enosys());
    },
    chown(path, uid, gid, callback) {
      callback(enosys());
    },
    close(fd, callback) {
      callback(enosys());
    },
    fchmod(fd, mode, callback) {
      callback(enosys());
    },
    fchown(fd, uid, gid, callback) {
      callback(enosys());
    },
    fstat(fd, callback) {
      callback(enosys());
    },
    fsync(fd, callback) {
      callback(null);
    },
    ftruncate(fd, length, callback) {
      callback(enosys());
    },
    lchown(path, uid, gid, callback) {
      callback(enosys());
    },
    link(path, link, callback) {
      callback(enosys());
    },
    lstat(path, callback) {
      callback(enosys());
    },
    mkdir(path, perm, callback) {
      callback(enosys());
    },
    open(path, flags, mode, callback) {
      callback(enosys());
    },
    read(fd, buffer, offset, length, position, callback) {
      callback(enosys());
    },
    readdir(path, callback) {
      callback(enosys());
    },
    readlink(path, callback) {
      callback(enosys());
    },
    rename(from, to, callback) {
      callback(enosys());
    },
    rmdir(path, callback) {
      callback(enosys());
    },
    stat(path, callback) {
      callback(enosys());
    },
    symlink(path, link, callback) {
      callback(enosys());
    },
    truncate(path, length, callback) {
      callback(enosys());
    },
    unlink(path, callback) {
      callback(enosys());
    },
    utimes(path, atime, mtime, callback) {
      callback(enosys());
    },
  };
}

let process = globalThis.process;
if (!process) {
  process = {
    getuid() {
      return -1;
    },
    getgid() {
      return -1;
    },
    geteuid() {
      return -1;
    },
    getegid() {
      return -1;
    },
    getgroups() {
      throw enosys();
    },
    pid: -1,
    ppid: -1,
    umask() {
      throw enosys();
    },
    cwd() {
      throw enosys();
    },
    chdir() {
      throw enosys();
    },
  };
}

if (!globalThis.crypto) {
  throw new Error(
    "globalThis.crypto is not available, polyfill required (crypto.getRandomValues only)"
  );
}

if (!globalThis.performance) {
  throw new Error(
    "globalThis.performance is not available, polyfill required (performance.now only)"
  );
}

if (!globalThis.TextEncoder) {
  throw new Error("globalThis.TextEncoder is not available, polyfill required");
}

if (!globalThis.TextDecoder) {
  throw new Error("globalThis.TextDecoder is not available, polyfill required");
}

const encoder = new TextEncoder("utf-8");
const decoder = new TextDecoder("utf-8");

class Go {
  constructor() {
    this.argv = ["js"];
    this.env = {};
    this.exit = (code) => {
      if (code !== 0) {
        console.warn("exit code:", code);
      }
    };
    this._exitPromise = new Promise((resolve) => {
      this._resolveExitPromise = resolve;
    });
    this._pendingEvent = null;
    this._scheduledTimeouts = new Map();
    this._nextCallbackTimeoutID = 1;

    const setInt64 = (addr, v) => {
      this.mem.setUint32(addr + 0, v, true);
      this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
    };

    const setInt32 = (addr, v) => {
      this.mem.setUint32(addr + 0, v, true);
    };

    const getInt64 = (addr) => {
      const low = this.mem.getUint32(addr + 0, true);
      const high = this.mem.getInt32(addr + 4, true);
      return low + high * 4294967296;
    };

    const loadValue = (addr) => {
      const f = this.mem.getFloat64(addr, true);
      if (f === 0) {
        return undefined;
      }
      if (!isNaN(f)) {
        return f;
      }

      const id = this.mem.getUint32(addr, true);
      return this._values[id];
    };

    const storeValue = (addr, v) => {
      const nanHead = 0x7ff80000;

      if (typeof v === "number" && v !== 0) {
        if (isNaN(v)) {
          this.mem.setUint32(addr + 4, nanHead, true);
          this.mem.setUint32(addr, 0, true);
          return;
        }
        this.mem.setFloat64(addr, v, true);
        return;
      }

      if (v === undefined) {
        this.mem.setFloat64(addr, 0, true);
        return;
      }

      let id = this._ids.get(v);
      if (id === undefined) {
        id = this._idPool.pop();
        if (id === undefined) {
          id = this._values.length;
        }
        this._values[id] = v;
        this._goRefCounts[id] = 0;
        this._ids.set(v, id);
      }
      this._goRefCounts[id]++;
      let typeFlag = 0;
      switch (typeof v) {
        case "object":
          if (v !== null) {
            typeFlag = 1;
          }
          break;
        case "string":
          typeFlag = 2;
          break;
        case "symbol":
          typeFlag = 3;
          break;
        case "function":
          typeFlag = 4;
          break;
      }
      this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
      this.mem.setUint32(addr, id, true);
    };

    const loadSlice = (addr) => {
      const array = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      return new Uint8Array(this._inst.exports.mem.buffer, array, len);
    };

    const loadSliceOfValues = (addr) => {
      const array = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      const a = new Array(len);
      for (let i = 0; i < len; i++) {
        a[i] = loadValue(array + i * 8);
      }
      return a;
    };

    const loadString = (addr) => {
      const saddr = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      return decoder.decode(
        new DataView(this._inst.exports.mem.buffer, saddr, len)
      );
    };

    const timeOrigin = Date.now() - performance.now();
    this.importObject = {
      _gotest: {
        add: (a, b) => a + b,
      },
      gojs: {
        // Go's SP does not change as long as no Go code is running. Some operations (e.g. calls, getters and setters)
        // may synchronously trigger a Go event handler. This makes Go code get executed in the middle of the imported
        // function. A goroutine can switch to a new stack if the current stack is too small (see morestack function).
        // This changes the SP, thus we have to update the SP used by the imported function.

        // func wasmExit(code int32)
        "runtime.wasmExit": (sp) => {
          sp >>>= 0;
          const code = this.mem.getInt32(sp + 8, true);
          this.exited = true;
          delete this._inst;
          delete this._values;
          delete this._goRefCounts;
          delete this._ids;
          delete this._idPool;
          this.exit(code);
        },

        // func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
        "runtime.wasmWrite": (sp) => {
          sp >>>= 0;
          const fd = getInt64(sp + 8);
          const p = getInt64(sp + 16);
          const n = this.mem.getInt32(sp + 24, true);
          fs.writeSync(fd, new Uint8Array(this._inst.exports.mem.buffer, p, n));
        },

        // func resetMemoryDataView()
        "runtime.resetMemoryDataView": (sp) => {
          sp >>>= 0;
          this.mem = new DataView(this._inst.exports.mem.buffer);
        },

        // func nanotime1() int64
        "runtime.nanotime1": (sp) => {
          sp >>>= 0;
          setInt64(sp + 8, (timeOrigin + performance.now()) * 1000000);
        },

        // func walltime() (sec int64, nsec int32)
        "runtime.walltime": (sp) => {
          sp >>>= 0;
          const msec = new Date().getTime();
          setInt64(sp + 8, msec / 1000);
          this.mem.setInt32(sp + 16, (msec % 1000) * 1000000, true);
        },

        // func scheduleTimeoutEvent(delay int64) int32
        "runtime.scheduleTimeoutEvent": (sp) => {
          sp >>>= 0;
          const id = this._nextCallbackTimeoutID;
          this._nextCallbackTimeoutID++;
          this._scheduledTimeouts.set(
            id,
            setTimeout(() => {
              this._resume();
              while (this._scheduledTimeouts.has(id)) {
                // for some reason Go failed to register the timeout event, log and try again
                // (temporary workaround for https://github.com/golang/go/issues/28975)
                console.warn("scheduleTimeoutEvent: missed timeout event");
                this._resume();
              }
            }, getInt64(sp + 8))
          );
          this.mem.setInt32(sp + 16, id, true);
        },

        // func clearTimeoutEvent(id int32)
        "runtime.clearTimeoutEvent": (sp) => {
          sp >>>= 0;
          const id = this.mem.getInt32(sp + 8, true);
          clearTimeout(this._scheduledTimeouts.get(id));
          this._scheduledTimeouts.delete(id);
        },

        // func getRandomData(r []byte)
        "runtime.getRandomData": (sp) => {
          sp >>>= 0;
          crypto.getRandomValues(loadSlice(sp + 8));
        },

        // func finalizeRef(v ref)
        "syscall/js.finalizeRef": (sp) => {
          sp >>>= 0;
          const id = this.mem.getUint32(sp + 8, true);
          this._goRefCounts[id]--;
          if (this._goRefCounts[id] === 0) {
            const v = this._values[id];
            this._values[id] = null;
            this._ids.delete(v);
            this._idPool.push(id);
          }
        },

        // func stringVal(value string) ref
        "syscall/js.stringVal": (sp) => {
          sp >>>= 0;
          storeValue(sp + 24, loadString(sp + 8));
        },

        // func valueGet(v ref, p string) ref
        "syscall/js.valueGet": (sp) => {
          sp >>>= 0;
          const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
          sp = this._inst.exports.getsp() >>> 0; // see comment above
          storeValue(sp + 32, result);
        },

        // func valueSet(v ref, p string, x ref)
        "syscall/js.valueSet": (sp) => {
          sp >>>= 0;
          Reflect.set(
            loadValue(sp + 8),
            loadString(sp + 16),
            loadValue(sp + 32)
          );
        },

        // func valueDelete(v ref, p string)
        "syscall/js.valueDelete": (sp) => {
          sp >>>= 0;
          Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
        },

        // func valueIndex(v ref, i int) ref
        "syscall/js.valueIndex": (sp) => {
          sp >>>= 0;
          storeValue(
            sp + 24,
            Reflect.get(loadValue(sp + 8), getInt64(sp + 16))
          );
        },

        // valueSetIndex(v ref, i int, x ref)
        "syscall/js.valueSetIndex": (sp) => {
          sp >>>= 0;
          Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
        },

        // func valueCall(v ref, m string, args []ref) (ref, bool)
        "syscall/js.valueCall": (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const m = Reflect.get(v, loadString(sp + 16));
            const args = loadSliceOfValues(sp + 32);
            const result = Reflect.apply(m, v, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 56, result);
            this.mem.setUint8(sp + 64, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 56, err);
            this.mem.setUint8(sp + 64, 0);
          }
        },

        // func valueInvoke(v ref, args []ref) (ref, bool)
        "syscall/js.valueInvoke": (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const args = loadSliceOfValues(sp + 16);
            const result = Reflect.apply(v, undefined, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // func valueNew(v ref, args []ref) (ref, bool)
        "syscall/js.valueNew": (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const args = loadSliceOfValues(sp + 16);
            const result = Reflect.construct(v, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // func valueLength(v ref) int
        "syscall/js.valueLength": (sp) => {
          sp >>>= 0;
          setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
        },

        // valuePrepareString(v ref) (ref, int)
        "syscall/js.valuePrepareString": (sp) => {
          sp >>>= 0;
          const str = encoder.encode(String(loadValue(sp + 8)));
          storeValue(sp + 16, str);
          setInt64(sp + 24, str.length);
        },

        // valueLoadString(v ref, b []byte)
        "syscall/js.valueLoadString": (sp) => {
          sp >>>= 0;
          const str = loadValue(sp + 8);
          loadSlice(sp + 16).set(str);
        },

        // func valueInstanceOf(v ref, t ref) bool
        "syscall/js.valueInstanceOf": (sp) => {
          sp >>>= 0;
          this.mem.setUint8(
            sp + 24,
            loadValue(sp + 8) instanceof loadValue(sp + 16) ? 1 : 0
          );
        },

        // func copyBytesToGo(dst []byte, src ref) (int, bool)
        "syscall/js.copyBytesToGo": (sp) => {
          sp >>>= 0;
          const dst = loadSlice(sp + 8);
          const src = loadValue(sp + 32);
          if (
            !(src instanceof Uint8Array || src instanceof Uint8ClampedArray)
          ) {
            this.mem.setUint8(sp + 48, 0);
            return;
          }
          const toCopy = src.subarray(0, dst.length);
          dst.set(toCopy);
          setInt64(sp + 40, toCopy.length);
          this.mem.setUint8(sp + 48, 1);
        },

        // func copyBytesToJS(dst ref, src []byte) (int, bool)
        "syscall/js.copyBytesToJS": (sp) => {
          sp >>>= 0;
          const dst = loadValue(sp + 8);
          const src = loadSlice(sp + 16);
          if (
            !(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)
          ) {
            this.mem.setUint8(sp + 48, 0);
            return;
          }
          const toCopy = src.subarray(0, dst.length);
          dst.set(toCopy);
          setInt64(sp + 40, toCopy.length);
          this.mem.setUint8(sp + 48, 1);
        },

        debug: (value) => {
          console.log(value);
        },
      },
    };
  }

  async run(instance) {
    if (!(instance instanceof WebAssembly.Instance)) {
      throw new Error("Go.run: WebAssembly.Instance expected");
    }
    this._inst = instance;
    this.mem = new DataView(this._inst.exports.mem.buffer);
    this._values = [
      // JS values that Go currently has references to, indexed by reference id
      NaN,
      0,
      null,
      true,
      false,
      globalThis,
      this,
    ];
    this._goRefCounts = new Array(this._values.length).fill(Infinity); // number of references that Go has to a JS value, indexed by reference id
    this._ids = new Map([
      // mapping from JS values to reference ids
      [0, 1],
      [null, 2],
      [true, 3],
      [false, 4],
      [globalThis, 5],
      [this, 6],
    ]);
    this._idPool = []; // unused ids that have been garbage collected
    this.exited = false; // whether the Go program has exited

    // Pass command line arguments and environment variables to WebAssembly by writing them to the linear memory.
    let offset = 4096;

    const strPtr = (str) => {
      const ptr = offset;
      const bytes = encoder.encode(str + "\0");
      new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
      offset += bytes.length;
      if (offset % 8 !== 0) {
        offset += 8 - (offset % 8);
      }
      return ptr;
    };

    const argc = this.argv.length;

    const argvPtrs = [];
    this.argv.forEach((arg) => {
      argvPtrs.push(strPtr(arg));
    });
    argvPtrs.push(0);

    const keys = Object.keys(this.env).sort();
    keys.forEach((key) => {
      argvPtrs.push(strPtr(`${key}=${this.env[key]}`));
    });
    argvPtrs.push(0);

    const argv = offset;
    argvPtrs.forEach((ptr) => {
      this.mem.setUint32(offset, ptr, true);
      this.mem.setUint32(offset + 4, 0, true);
      offset += 8;
    });

    // The linker guarantees global data starts from at least wasmMinDataAddr.
    // Keep in sync with cmd/link/internal/ld/data.go:wasmMinDataAddr.
    const wasmMinDataAddr = 4096 + 8192;
    if (offset >= wasmMinDataAddr) {
      throw new Error(
        "total length of command line and environment variables exceeds limit"
      );
    }

    this._inst.exports.run(argc, argv);
    if (this.exited) {
      this._resolveExitPromise();
    }
    await this._exitPromise;
  }

  _resume() {
    if (this.exited) {
      throw new Error("Go program has already exited");
    }
    this._inst.exports.resume();
    if (this.exited) {
      this._resolveExitPromise();
    }
  }

  _makeFuncWrapper(id) {
    const go = this;
    return function () {
      const event = { id: id, this: this, args: arguments };
      go._pendingEvent = event;
      go._resume();
      return event.result;
    };
  }

  exports = { __proto__: null };
  _import(s, o) {
    return import(s, o);
  }
}

let base64Characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
let base64UrlCharacters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

let tag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag
).get;
export function checkUint8Array(arg) {
  let kind;
  try {
    kind = tag.call(arg);
  } catch {
    throw new TypeError("not a Uint8Array");
  }
  if (kind !== "Uint8Array") {
    throw new TypeError("not a Uint8Array");
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assert failed: ${message}`);
  }
}

function getOptions(options) {
  if (typeof options === "undefined") {
    return Object.create(null);
  }
  if (options && typeof options === "object") {
    return options;
  }
  throw new TypeError("options is not object");
}

export function uint8ArrayToBase64(arr, options) {
  checkUint8Array(arr);
  let opts = getOptions(options);
  let alphabet = opts.alphabet;
  if (typeof alphabet === "undefined") {
    alphabet = "base64";
  }
  if (alphabet !== "base64" && alphabet !== "base64url") {
    throw new TypeError(
      'expected alphabet to be either "base64" or "base64url"'
    );
  }

  if ("detached" in arr.buffer && arr.buffer.detached) {
    throw new TypeError("toBase64 called on array backed by detached buffer");
  }

  let lookup = alphabet === "base64" ? base64Characters : base64UrlCharacters;
  let result = "";

  let i = 0;
  for (; i + 2 < arr.length; i += 3) {
    let triplet = (arr[i] << 16) + (arr[i + 1] << 8) + arr[i + 2];
    result +=
      lookup[(triplet >> 18) & 63] +
      lookup[(triplet >> 12) & 63] +
      lookup[(triplet >> 6) & 63] +
      lookup[triplet & 63];
  }
  if (i + 2 === arr.length) {
    let triplet = (arr[i] << 16) + (arr[i + 1] << 8);
    result +=
      lookup[(triplet >> 18) & 63] +
      lookup[(triplet >> 12) & 63] +
      lookup[(triplet >> 6) & 63] +
      "=";
  } else if (i + 1 === arr.length) {
    let triplet = arr[i] << 16;
    result +=
      lookup[(triplet >> 18) & 63] + lookup[(triplet >> 12) & 63] + "==";
  }
  return result;
}

function decodeBase64Chunk(chunk, throwOnExtraBits) {
  let actualChunkLength = chunk.length;
  if (actualChunkLength < 4) {
    chunk += actualChunkLength === 2 ? "AA" : "A";
  }

  let map = new Map(base64Characters.split("").map((c, i) => [c, i]));

  let c1 = chunk[0];
  let c2 = chunk[1];
  let c3 = chunk[2];
  let c4 = chunk[3];

  let triplet =
    (map.get(c1) << 18) +
    (map.get(c2) << 12) +
    (map.get(c3) << 6) +
    map.get(c4);

  let chunkBytes = [(triplet >> 16) & 255, (triplet >> 8) & 255, triplet & 255];

  if (actualChunkLength === 2) {
    if (throwOnExtraBits && chunkBytes[1] !== 0) {
      throw new SyntaxError("extra bits");
    }
    return [chunkBytes[0]];
  } else if (actualChunkLength === 3) {
    if (throwOnExtraBits && chunkBytes[2] !== 0) {
      throw new SyntaxError("extra bits");
    }
    return [chunkBytes[0], chunkBytes[1]];
  }
  return chunkBytes;
}

function skipAsciiWhitespace(string, index) {
  for (; index < string.length; ++index) {
    if (!/[\u0009\u000A\u000C\u000D\u0020]/.test(string[index])) {
      break;
    }
  }
  return index;
}

function fromBase64(string, alphabet, lastChunkHandling, maxLength) {
  if (maxLength === 0) {
    return { read: 0, bytes: [] };
  }

  let read = 0;
  let bytes = [];
  let chunk = "";

  let index = 0;
  while (true) {
    index = skipAsciiWhitespace(string, index);
    if (index === string.length) {
      if (chunk.length > 0) {
        if (lastChunkHandling === "stop-before-partial") {
          return { bytes, read };
        } else if (lastChunkHandling === "loose") {
          if (chunk.length === 1) {
            throw new SyntaxError(
              "malformed padding: exactly one additional character"
            );
          }
          bytes.push(...decodeBase64Chunk(chunk, false));
        } else {
          assert(lastChunkHandling === "strict");
          throw new SyntaxError("missing padding");
        }
      }
      return { bytes, read: string.length };
    }
    let char = string[index];
    ++index;
    if (char === "=") {
      if (chunk.length < 2) {
        throw new SyntaxError("padding is too early");
      }
      index = skipAsciiWhitespace(string, index);
      if (chunk.length === 2) {
        if (index === string.length) {
          if (lastChunkHandling === "stop-before-partial") {
            // two characters then `=` then EOS: this is, technically, a partial chunk
            return { bytes, read };
          }
          throw new SyntaxError("malformed padding - only one =");
        }
        if (string[index] === "=") {
          ++index;
          index = skipAsciiWhitespace(string, index);
        }
      }
      if (index < string.length) {
        throw new SyntaxError("unexpected character after padding");
      }
      bytes.push(...decodeBase64Chunk(chunk, lastChunkHandling === "strict"));
      assert(bytes.length <= maxLength);
      return { bytes, read: string.length };
    }
    if (alphabet === "base64url") {
      if (char === "+" || char === "/") {
        throw new SyntaxError(`unexpected character ${JSON.stringify(char)}`);
      } else if (char === "-") {
        char = "+";
      } else if (char === "_") {
        char = "/";
      }
    }
    if (!base64Characters.includes(char)) {
      throw new SyntaxError(`unexpected character ${JSON.stringify(char)}`);
    }
    let remainingBytes = maxLength - bytes.length;
    if (
      (remainingBytes === 1 && chunk.length === 2) ||
      (remainingBytes === 2 && chunk.length === 3)
    ) {
      // special case: we can fit exactly the number of bytes currently represented by chunk, so we were just checking for `=`
      return { bytes, read };
    }

    chunk += char;
    if (chunk.length === 4) {
      bytes.push(...decodeBase64Chunk(chunk, false));
      chunk = "";
      read = index;
      assert(bytes.length <= maxLength);
      if (bytes.length === maxLength) {
        return { bytes, read };
      }
    }
  }
}

function base64ToUint8Array(string, options, into) {
  let opts = getOptions(options);
  let alphabet = opts.alphabet;
  if (typeof alphabet === "undefined") {
    alphabet = "base64";
  }
  if (alphabet !== "base64" && alphabet !== "base64url") {
    throw new TypeError(
      'expected alphabet to be either "base64" or "base64url"'
    );
  }
  let lastChunkHandling = opts.lastChunkHandling;
  if (typeof lastChunkHandling === "undefined") {
    lastChunkHandling = "loose";
  }
  if (!["loose", "strict", "stop-before-partial"].includes(lastChunkHandling)) {
    throw new TypeError(
      'expected lastChunkHandling to be either "loose", "strict", or "stop-before-partial"'
    );
  }
  if (into && "detached" in into.buffer && into.buffer.detached) {
    throw new TypeError(
      "toBase64Into called on array backed by detached buffer"
    );
  }

  let maxLength = into ? into.length : 2 ** 53 - 1;

  let { bytes, read } = fromBase64(
    string,
    alphabet,
    lastChunkHandling,
    maxLength
  );

  bytes = new Uint8Array(bytes);
  if (into && bytes.length > 0) {
    assert(bytes.length <= into.length);
    into.set(bytes);
  }

  return { read, bytes };
}

function uint8ArrayToHex(arr) {
  checkUint8Array(arr);
  if ("detached" in arr.buffer && arr.buffer.detached) {
    throw new TypeError("toHex called on array backed by detached buffer");
  }
  let out = "";
  for (let i = 0; i < arr.length; ++i) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToUint8Array(string, into) {
  if (typeof string !== "string") {
    throw new TypeError("expected string to be a string");
  }
  if (into && "detached" in into.buffer && into.buffer.detached) {
    throw new TypeError(
      "fromHexInto called on array backed by detached buffer"
    );
  }
  if (string.length % 2 !== 0) {
    throw new SyntaxError("string should be an even number of characters");
  }

  let maxLength = into ? into.length : 2 ** 53 - 1;

  // TODO should hex allow whitespace?
  // TODO should hex support lastChunkHandling? (only 'strict' or 'stop-before-partial')
  let bytes = [];
  let index = 0;
  if (maxLength > 0) {
    while (index < string.length) {
      let hexits = string.slice(index, index + 2);
      if (/[^0-9a-fA-F]/.test(hexits)) {
        throw new SyntaxError("string should only contain hex characters");
      }
      bytes.push(parseInt(hexits, 16));
      index += 2;
      if (bytes.length === maxLength) {
        break;
      }
    }
  }

  bytes = new Uint8Array(bytes);
  if (into && bytes.length > 0) {
    assert(bytes.length <= into.length);
    into.set(bytes);
  }

  return { read: index, bytes };
}

// method shenanigans to make a non-constructor which can refer to "this"
Uint8Array.prototype.toBase64 = {
  toBase64(options) {
    return uint8ArrayToBase64(this, options);
  },
}.toBase64;
Object.defineProperty(Uint8Array.prototype, "toBase64", { enumerable: false });
Object.defineProperty(Uint8Array.prototype.toBase64, "length", { value: 0 });

Uint8Array.fromBase64 = (string, options) => {
  if (typeof string !== "string") {
    throw new TypeError("expected input to be a string");
  }
  return base64ToUint8Array(string, options).bytes;
};
Object.defineProperty(Uint8Array, "fromBase64", { enumerable: false });
Object.defineProperty(Uint8Array.fromBase64, "length", { value: 1 });
Object.defineProperty(Uint8Array.fromBase64, "name", { value: "fromBase64" });

// method shenanigans to make a non-constructor which can refer to "this"
Uint8Array.prototype.setFromBase64 = {
  setFromBase64(string, options) {
    checkUint8Array(this);
    if (typeof string !== "string") {
      throw new TypeError("expected input to be a string");
    }
    let { read, bytes } = base64ToUint8Array(string, options, this);
    return { read, written: bytes.length };
  },
}.setFromBase64;
Object.defineProperty(Uint8Array.prototype, "setFromBase64", {
  enumerable: false,
});
Object.defineProperty(Uint8Array.prototype.setFromBase64, "length", {
  value: 1,
});

Uint8Array.prototype.toHex = {
  toHex() {
    return uint8ArrayToHex(this);
  },
}.toHex;
Object.defineProperty(Uint8Array.prototype, "toHex", { enumerable: false });

Uint8Array.fromHex = (string) => {
  if (typeof string !== "string") {
    throw new TypeError("expected input to be a string");
  }
  return hexToUint8Array(string).bytes;
};
Object.defineProperty(Uint8Array, "fromHex", { enumerable: false });
Object.defineProperty(Uint8Array.fromHex, "name", { value: "fromHex" });

Uint8Array.prototype.setFromHex = {
  setFromHex(string) {
    checkUint8Array(this);
    if (typeof string !== "string") {
      throw new TypeError("expected input to be a string");
    }
    let { read, bytes } = hexToUint8Array(string, this);
    return { read, written: bytes.length };
  },
}.setFromHex;
Object.defineProperty(Uint8Array.prototype, "setFromHex", {
  enumerable: false,
});

// __EMBED_* constants are prepended to this file at build time.
const testWASMGzBase64Text = /** @type {string} */ (
  __EMBED_TEST_WASM_GZ_BASE64_TEXT
);
const testWASMGzBytes = Uint8Array.fromBase64(testWASMGzBase64Text);
const testWASMReadable = new Response(testWASMGzBytes).body.pipeThrough(
  new DecompressionStream("gzip")
);
const testWASMResponse = new Response(testWASMReadable, {
  headers: { "Content-Type": "application/wasm" },
});

const go = new Go();
const { module, instance } = await WebAssembly.instantiateStreaming(
  testWASMResponse,
  go.importObject
);
await go.run(instance);

export const exports = go.exports;
