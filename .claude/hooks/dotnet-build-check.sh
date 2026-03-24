#!/usr/bin/env bash
# Runs a fast incremental build of the nearest .csproj after a C# file is edited.
# Provides immediate feedback on compile errors without running the full solution build.
#
# Exit codes:
#   0 — build succeeded (or file is not a .cs file)
#   1 — build failed; Claude Code surfaces the output as a warning

# Claude Code passes tool context as JSON on stdin — extract the file path.
FILE=$(node -e 'var d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.tool_input.file_path||"")' 2>/dev/null) || FILE=""

# Only act on C# source files (*.cs suffix check works on both slash styles)
if [[ "$FILE" != *.cs ]]; then
    exit 0
fi

# Normalize path separators (Windows backslashes → forward slashes) for dirname/find
FILE=$(echo "$FILE" | sed 's|\\|/|g')

# Walk up the directory tree to find the nearest .csproj
dir=$(dirname "$FILE")
proj=""
while [[ -n "$dir" && "$dir" != "/" && "$dir" != "." ]]; do
    found=$(find "$dir" -maxdepth 1 -name "*.csproj" 2>/dev/null | head -1)
    if [[ -n "$found" ]]; then
        proj="$found"
        break
    fi
    parent=$(dirname "$dir")
    [[ "$parent" == "$dir" ]] && break
    dir="$parent"
done

if [[ -z "$proj" ]]; then
    exit 0
fi

echo "Building $(basename "$proj")..."
dotnet build "$proj" --no-restore --verbosity quiet 2>&1
