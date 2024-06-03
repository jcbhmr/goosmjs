package main

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"log"
	"os"

	exec "golang.org/x/sys/execabs"
)

//go:embed wrapper.js
var wrapperJS string

func main() {
	os.Chdir("./examples/hello-world")

	cmd := exec.Command("go", "build", "-o", "test.wasm", ".")
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "GOOS=js", "GOARCH=wasm")
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		log.Fatal(err)
	}

	testWASM, err := os.ReadFile("test.wasm")
	if err != nil {
		log.Fatal(err)
	}
	err = os.Remove("test.wasm")
	if err != nil {
		log.Fatal(err)
	}

	testWASMGz := bytes.Buffer{}
	gzWriter := gzip.NewWriter(&testWASMGz)
	_, err = gzWriter.Write(testWASM)
	if err != nil {
		log.Fatal(err)
	}
	err = gzWriter.Close()
	if err != nil {
		log.Fatal(err)
	}

	testWASMGzBase64Text := base64.RawStdEncoding.EncodeToString(testWASMGz.Bytes())

	testWASMGzBase64TextJSON, err := json.Marshal(testWASMGzBase64Text)
	if err != nil {
		log.Fatal(err)
	}

	preludeJS := "const __EMBED_TEST_WASM_GZ_BASE64_TEXT = " + string(testWASMGzBase64TextJSON) + ";\n"

	artifactJS := preludeJS + "\n" + wrapperJS

	err = os.WriteFile("test.mjs", []byte(artifactJS), 0644)
	if err != nil {
		log.Fatal(err)
	}

	cmd = exec.Command("node", "test.mjs")
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		log.Fatal(err)
	}
}
