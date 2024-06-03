package main

import (
	"errors"
	"os"

	exec "golang.org/x/sys/execabs"
)

func Exec(argv0 string, argv []string, envv []string) error {
	cmd := exec.Cmd{
		Path: argv0,
		Args: argv,
	}
	cmd.Env = envv
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			os.Exit(exitErr.ExitCode())
		} else {
			return err
		}
	} else {
		os.Exit(0)
	}
	return nil
}
