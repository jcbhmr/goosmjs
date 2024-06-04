# Better `GOOS=js`

## Installation

```sh
go install github.com/jcbhmr/goos-js2-go@latest
```

## Usage

```sh
goos-js2-go build .
```

## Development

idea

symlink everything in go/ except go/src/ then symlink go/src/cmd/ but nothing else. apply go.patch to go/ to add Import() and fs process stuff. do all this at runtime "build" cmd. then embed as Uint8Array.fromBase64(EMBEDSTRINGHERE) constant and tada!
