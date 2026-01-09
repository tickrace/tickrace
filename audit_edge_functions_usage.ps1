$ErrorActionPreference = "Stop"

$projectRoot = (Get-Location).Path
$functionsRoot = Join-Path $projectRoot "supabase\functions"
if (!(Test-Path $functionsRoot)) { throw "Dossier introuvable: $functionsRoot" }

# Où chercher des appels (évite node_modules/dist/.git)
$scanDirs = @("src", "supabase", "api", "server", "functions")
$scanPaths = @()
foreach ($d in $scanDirs) {
  $p = Join-Path $projectRoot $d
  if (Test-Path $p) { $scanPaths += $p }
}
if ($scanPaths.Count -eq 0) { $scanPaths = @($projectRoot) }

# Fichiers à scanner (rapide + utile)
$includeExt = @("*.js","*.jsx","*.ts","*.tsx","*.json","*.sql","*.md")
$files = @()
foreach ($p in $scanPaths) {
  $files += Get-ChildItem -Path $p -Recurse -File -Include $includeExt -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -notmatch "\\node_modules\\|\\dist\\|\\build\\|\\out\\|\\\.git\\|\\\.next\\|\\\.vercel\\"
    }
}
$files = $files | Sort-Object FullName -Unique

# Liste des fonctions (dossiers) - exclude _shared
$funcs = Get-ChildItem $functionsRoot -Directory |
  Where-Object { $_.Name -ne "_shared" } |
  Sort-Object Name |
  Select-Object -ExpandProperty Name

$out = Join-Path $projectRoot "EDGE_FUNCTIONS_USAGE_REPORT.md"

"<!-- EDGE FUNCTIONS USAGE REPORT -->`n" | Out-File -Encoding utf8 $out
"Scanned paths:`n" | Out-File -Encoding utf8 -Append $out
$scanPaths | ForEach-Object { "- $($_.ToString())" } | Out-File -Encoding utf8 -Append $out
("`nScanned files: " + $files.Count + "`n") | Out-File -Encoding utf8 -Append $out
"`n---`n" | Out-File -Encoding utf8 -Append $out

function Count-Matches($pattern) {
  $m = 0
  foreach ($f in $files) {
    $hits = Select-String -Path $f.FullName -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue
    if ($hits) { $m += $hits.Count }
  }
  return $m
}

function Sample-Hits($pattern, $max=3) {
  $rows = New-Object System.Collections.Generic.List[string]
  foreach ($f in $files) {
    $hits = Select-String -Path $f.FullName -Pattern $pattern -ErrorAction SilentlyContinue
    foreach ($h in $hits) {
      $rel = $h.Path.Replace($projectRoot + "\", "")
      $rows.Add(("- " + $rel + ":" + $h.LineNumber + " :: " + $h.Line.Trim()))
      if ($rows.Count -ge $max) { return $rows }
    }
  }
  return $rows
}

"| function | invoke('name') | /functions/v1/name | name mention | samples |" | Out-File -Encoding utf8 -Append $out
"|---|---:|---:|---:|---|" | Out-File -Encoding utf8 -Append $out

foreach ($name in $funcs) {
  # appels typiques dans le code
  $pInvoke = "functions\s*\.\s*invoke\s*\(\s*['""]$name['""]"
  $pHttp   = "/functions/v1/$name"
  $pLoose  = "(?i)\b$name\b"

  $cInvoke = Count-Matches $pInvoke
  $cHttp   = Count-Matches $pHttp
  $cLoose  = Count-Matches $pLoose

  $samples = @()
  $samples += (Sample-Hits $pInvoke 2)
  if ($samples.Count -lt 2) { $samples += (Sample-Hits $pHttp 2) }
  if ($samples.Count -lt 2) { $samples += (Sample-Hits $pLoose 2) }

  $samplesText = if ($samples.Count -gt 0) { ($samples -join "<br/>") } else { "" }

  "| $name | $cInvoke | $cHttp | $cLoose | $samplesText |" | Out-File -Encoding utf8 -Append $out
}

Write-Host "OK -> $out"
