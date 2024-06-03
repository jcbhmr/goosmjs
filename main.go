package main

import (
	"flag"
	"log"
	"os"
	"slices"
	"strings"

	exec "golang.org/x/sys/execabs"
)

func main() {
	if len(os.Args) >= 2 {
		if os.Args[1] == "build" {
			v := false
			for _, arg := range os.Args[2:] {
				if arg == "-v" {
					v = true
					break
				}
			}
			flagArgs := append([]string(nil), os.Args[2:]...)
			if !v {
				flagArgs = append([]string{"-v"}, flagArgs...)
			}

			return
		} else if os.Args[1] == "run" {

			return
		} else if os.Args[1] == "test" {
			return
		}
	}

	argv := append([]string(nil), os.Args...)
	if len(argv) == 0 {
		argv = append(argv, "go")
	} else {
		argv[0] = "go"
	}
	argv0, err := exec.LookPath(argv[0])
	if err != nil {
		log.Fatal(err)
	}
	envv := os.Environ()
	envv = append(envv, "GOOS=js", "GOARCH=wasm")

	err = Exec(argv0, argv, envv)
	if err != nil {
		log.Fatal(err)
	}
}
