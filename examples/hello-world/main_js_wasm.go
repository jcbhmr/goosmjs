package main

import (
	"syscall/js"

	js2 "github.com/jcbhmr/goos-js2-go/syscall/js"
)

func main() {
	jsNodeHTTP := js2.Await(js2.Import("node:http", nil))
	jsHandler := js.FuncOf(func(this js.Value, args []js.Value) any {
		// req := args[0]
		res := args[1]
		res.Call("writeHead", 200, map[string]string{"Content-Type": "text/plain"})
		res.Call("end", "Hello, World!")
		return nil
	})
	jsServer := jsNodeHTTP.Call("createServer", jsHandler)
	jsServer.Call("listen", 8080)
	js2.Export("close", js.FuncOf(func(this js.Value, args []js.Value) any {
		jsServer.Call("close")
		return nil
	}))
	select {}
}
