package js

import (
	"syscall/js"
	"unsafe"
)

func ptr[T any](v T) *T {
	return &v
}

var jsGo = func(id uint32, typeFlag byte) js.Value {
	type ref uint64
	const nanHead = 0x7FF80000
	v := struct {
		_     [0]func()
		ref   ref
		gcPtr *ref
	}{ref: (nanHead|ref(typeFlag))<<32 | ref(id)}
	return *(*js.Value)(unsafe.Pointer(&v))
}(6, 1)

func Import(specifier any, options any) js.Value {
	return jsGo.Call("_import", specifier, options)
}

var jsPromise *js.Value

func Await(v js.Value) js.Value {
	if jsPromise == nil {
		jsPromise = ptr(js.Global().Get("Promise"))
	}
	jsP := jsPromise.Call("resolve", v)
	c := make(chan js.Value)
	jsHandleResolve := js.FuncOf(func(this js.Value, args []js.Value) any {
		c <- args[0]
		return nil
	})
	jsHandleReject := js.FuncOf(func(this js.Value, args []js.Value) any {
		panic(&js.Error{Value: args[0]})
		// return nil
	})
	jsP.Call("then", jsHandleResolve, jsHandleReject)
	return <-c
}

var jsExports *js.Value

func Export(name string, value any) {
	if jsExports == nil {
		jsExports = ptr(jsGo.Get("exports"))
	}
	jsExports.Set(name, value)
}
