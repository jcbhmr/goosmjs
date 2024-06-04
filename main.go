package main

import "wasd"

func main() {
	wasd.Wasd()
}

// import (
// 	"bytes"
// 	"compress/gzip"
// 	_ "embed"
// 	"encoding/base64"
// 	"encoding/json"
// 	"hello"
// 	"log"
// 	"os"

// 	exec "golang.org/x/sys/execabs"
// )

// //go:embed wrapper.js
// var wrapperJS string

// func main() {
// 	log.SetFlags(0)
// 	os.Chdir("./examples/hello-world")

// 	cmd := exec.Command("go", "build", "-o", "test.wasm", ".")
// 	cmd.Env = os.Environ()
// 	cmd.Env = append(cmd.Env, "GOOS=js", "GOARCH=wasm")
// 	cmd.Stdin = os.Stdin
// 	cmd.Stdout = os.Stdout
// 	cmd.Stderr = os.Stderr
// 	err := cmd.Run()
// 	if err != nil {
// 		log.Fatalf("cmd.Run() failed: %v", err)
// 	}

// 	testWASM, err := os.ReadFile("test.wasm")
// 	if err != nil {
// 		log.Fatalf("os.ReadFile() %#v failed: %v", "test.wasm", err)
// 	}
// 	err = os.Remove("test.wasm")
// 	if err != nil {
// 		log.Fatalf("os.Remove() %#v failed: %v", "test.wasm", err)
// 	}

// 	testWASMGz := bytes.Buffer{}
// 	gzWriter := gzip.NewWriter(&testWASMGz)
// 	_, err = gzWriter.Write(testWASM)
// 	if err != nil {
// 		log.Fatalf("gzWriter.Write() failed: %v", err)
// 	}
// 	err = gzWriter.Close()
// 	if err != nil {
// 		log.Fatalf("gzWriter.Close() failed: %v", err)
// 	}

// 	testWASMGzBase64Text := base64.RawStdEncoding.EncodeToString(testWASMGz.Bytes())

// 	testWASMGzBase64TextJSON, err := json.Marshal(testWASMGzBase64Text)
// 	if err != nil {
// 		log.Fatalf("json.Marshal() failed: %v", err)
// 	}

// 	preludeJS := "const __EMBED_TEST_WASM_GZ_BASE64_TEXT = " + string(testWASMGzBase64TextJSON) + ";\n"

// 	artifactJS := preludeJS + "\n" + wrapperJS

// 	log.Printf("Writing test.mjs")
// 	err = os.WriteFile("test.mjs", []byte(artifactJS), 0644)
// 	if err != nil {
// 		log.Fatalf("os.WriteFile() %#v failed: %v", "test.mjs", err)
// 	}

// 	cmd = exec.Command("node", "test.mjs")
// 	cmd.Stdin = os.Stdin
// 	cmd.Stdout = os.Stdout
// 	cmd.Stderr = os.Stderr
// 	log.Printf("$ %s", cmd.String())
// 	err = cmd.Run()
// 	if err != nil {
// 		log.Fatalf("cmd.Run() failed: %v", err)
// 	}
// }

// func init() {
// 	hello.Hello()
// }