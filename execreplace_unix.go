//go:build linux || darwin

package main

import (
	"golang.org/x/sys/unix"
)

func Exec(argv0 string, argv []string, envv []string) error {
	return unix.Exec(argv0, argv, envv)
}
