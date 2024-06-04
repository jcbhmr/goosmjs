package main

// import (
// 	"log"
// 	"syscall/js"

// 	js2 "github.com/jcbhmr/goos-js2-go/syscall/js"
// )

// var jsNodeHTTP js.Value

// func init() {
// 	jsNodeHTTP = js2.Await(js2.Import("node:http", js.Value{}))

// 	jsStart := js.FuncOf(Start)
// 	js2.Export("example.org/hello-world.start", jsStart)

// 	jsStop := js.FuncOf(Stop)
// 	js2.Export("example.org/hello-world.stop", jsStop)
// }

// var jsServer js.Value

// func Start(this js.Value, args []js.Value) any {
// 	jsHandler := js.FuncOf(func(this js.Value, args []js.Value) any {
// 		// req := args[0]
// 		res := args[1]
// 		res.Call("writeHead", 200, map[string]any{"Content-Type": "text/plain"})
// 		res.Call("end", "Hello, World!")
// 		return js.Value{}
// 	})
// 	jsServer = jsNodeHTTP.Call("createServer", jsHandler)
// 	jsServer.Call("listen", 8080)
// 	log.Printf("Listening on http://localhost:8080/")
// 	return js.Value{}
// }

// func Stop(this js.Value, args []js.Value) any {
// 	jsServer.Call("close")
// 	return js.Value{}
// }

func main() {
	select {}
}
