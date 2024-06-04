package js

import (
	"syscall/js"
	"unsafe"
)

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

var jsPromise js.Value

func Await(v js.Value) js.Value {
	if jsPromise.IsUndefined() {
		jsPromise = (js.Global().Get("Promise"))
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

var jsExports js.Value

func Export(name string, value any) {
	if jsExports.IsUndefined() {
		jsExports = jsGo.Get("exports")
	}
	jsExports.Set(name, value)
}

var jsGlobalThis js.Value

func Global() js.Value {
	if jsGlobalThis.IsUndefined() {
		jsGlobalThis = js.Global().Get("globalThis")
	}
	return jsGlobalThis
}

func Parallel() {
	jsGo.Call("_parallel")
}
