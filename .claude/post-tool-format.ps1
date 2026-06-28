$stdin = [System.Console]::In.ReadToEnd()
$data = $stdin | ConvertFrom-Json
$file = $data.tool_input.file_path

if (-not $file) { exit 0 }

$projectRoot = "C:\Users\PC2026\Develop\claude-course-devtalles\arcade-vault"
Set-Location $projectRoot

if ($file -match '\.(tsx?|jsx?|mjs|cjs|mts|cts)$') {
    npx prettier --write $file 2>$null
    npx eslint --fix $file 2>$null
} elseif ($file -match '\.(css|json|md|mdx|yaml|yml)$') {
    npx prettier --write $file 2>$null
}
