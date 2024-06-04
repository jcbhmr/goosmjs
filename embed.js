#!/usr/bin/env node
import process from "node:process";
import { readFile, glob } from "node:fs/promises";
import { parseArgs } from "node:util";
import { delimiter, dirname, join } from "node:path";

function isConstructor(f) {
  try {
    Reflect.construct(Object, [], f);
  } catch (err) {
    return false;
  }
}

const ArrayFromAsync = async function (items, mapfn, thisArg) {
  if (Symbol.asyncIterator in items || Symbol.iterator in items) {
    const result = isConstructor(this) ? new this() : Array(0);

    let i = 0;
    for await (const v of items) {
      if (i > Number.MAX_SAFE_INTEGER) {
        throw TypeError(
          "Input is too long and exceeded Number.MAX_SAFE_INTEGER times."
        );
      } else if (mapfn) {
        result[i] = await mapfn.call(thisArg, v, i);
      } else {
        result[i] = v;
      }
      i++;
    }
    result.length = i;
    return result;
  } else {
    const { length } = items;
    const result = isConstructor(this)
      ? new this(length)
      : IntrinsicArray(length);

    let i = 0;
    while (i < length) {
      if (i > MAX_SAFE_INTEGER) {
        throw TypeError(tooLongErrorMessage);
      }
      const v = await items[i];
      if (mapfn) {
        result[i] = await mapfn.call(thisArg, v, i);
      } else {
        result[i] = v;
      }
      i++;
    }
    result.length = i;
    return result;
  }
};

const Uint8ArrayPrototypeToBase64 = Object.call.bind({}.f);

const options = {
  help: { type: "boolean" },
  version: { type: "boolean" },
};
const { values, positionals } = parseArgs({ options, allowPositionals: true });

const globPatterns = positionals.length
  ? positionals
  : ["./*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"];

let sourceFilePaths = await ArrayFromAsync(
  glob(globPatterns, {
    exclude: (x) => /(?:^|\/|\\)node_modules(?:\/|\\|$)/.test(x),
  })
);
sourceFilePaths = sourceFilePaths.filter(
  (x) =>
    /\.[cm]?[jt]sx?$/.test(x) &&
    !/\.d\.[cm]?[jt]sx?$/.test(x) &&
    !/\.d\.[^\.]+\.[cm]?[jt]sx?$/.test(x)
);

for (const path of sourceFilePaths) {
  if (values.verbose) {
    console.log(path);
  }

  const code = await readFile(path, "utf8");

  for (const match of code.matchAll(
    /^\/\/js:embed\s+(.+)\r?\n\s*const\s+([a-zA-Z$_][a-zA-Z0-9$_]*)\s*=\s*/gm
  )) {
    const embedFilePath = match[1];
    if (/\.?\.?\//.test(embedFilePath)) {
      throw new DOMException(
        "Embed path must be relative to the source file.",
        "SyntaxError")
      }
    const embedFilePathAbs = join(dirname(path), embedFilePath);
    const embedFileNodeBuffer = await readFile(embedFilePathAbs);
    const embedFileBytes = new Uint8Array(embedFileNodeBuffer, embedFileNodeBuffer.byteOffset, embedFileNodeBuffer.byteLength);
  }
}
