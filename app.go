package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx       context.Context
	directory string
}

type FileEntry struct {
	Number   int    `json:"number"`
	Name     string `json:"name"`
	FullName string `json:"fullName"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

var numberPrefix = regexp.MustCompile(`^(\d+)\s*-\s*(.*)$`)

func parseFileName(name string) (int, string, bool) {
	matches := numberPrefix.FindStringSubmatch(name)
	if matches == nil {
		return 0, name, false
	}
	num, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, name, false
	}
	return num, matches[2], true
}

func (a *App) SelectDirectory() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Lecture Folder",
	})
	if err != nil {
		log.Printf("SelectDirectory error: %v", err)
		return "", err
	}
	if dir == "" {
		return "", nil
	}
	log.Printf("Selected directory: %s", dir)
	a.directory = dir
	return dir, nil
}

func (a *App) GetFiles() ([]FileEntry, error) {
	if a.directory == "" {
		return nil, fmt.Errorf("no directory selected")
	}

	log.Printf("Reading directory: %s", a.directory)
	entries, err := os.ReadDir(a.directory)
	if err != nil {
		log.Printf("ReadDir error: %v", err)
		return nil, err
	}
	log.Printf("Found %d entries", len(entries))

	files := make([]FileEntry, 0)
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		num, name, ok := parseFileName(entry.Name())
		if !ok {
			continue
		}
		files = append(files, FileEntry{
			Number:   num,
			Name:     name,
			FullName: entry.Name(),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Number < files[j].Number
	})

	return files, nil
}

func (a *App) Reorder(orderedNames []string) error {
	if a.directory == "" {
		return fmt.Errorf("no directory selected")
	}

	// First pass: rename all to temp names to avoid collisions
	tempNames := make([]string, len(orderedNames))
	for i, fullName := range orderedNames {
		_, name, ok := parseFileName(fullName)
		if !ok {
			name = fullName
		}
		temp := fmt.Sprintf("__temp_%d - %s", i+1, name)
		tempNames[i] = temp
		src := filepath.Join(a.directory, fullName)
		dst := filepath.Join(a.directory, temp)
		if err := os.Rename(src, dst); err != nil {
			return fmt.Errorf("rename %q -> %q: %w", fullName, temp, err)
		}
	}

	// Second pass: rename from temp to final names
	for i, temp := range tempNames {
		// Strip the "__temp_N - " prefix to get original name
		name := strings.TrimPrefix(temp, fmt.Sprintf("__temp_%d - ", i+1))
		final := fmt.Sprintf("%d - %s", i+1, name)
		src := filepath.Join(a.directory, temp)
		dst := filepath.Join(a.directory, final)
		if err := os.Rename(src, dst); err != nil {
			return fmt.Errorf("rename %q -> %q: %w", temp, final, err)
		}
	}

	return nil
}
