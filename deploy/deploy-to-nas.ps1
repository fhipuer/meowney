[CmdletBinding()]
param(
    [switch]$AllowNonMain,
    [switch]$AllowDirty,
    [switch]$DeployEnv
)

$ErrorActionPreference = "Stop"
$NasHostName = "192.168.0.9"
$NasPort = 1024
$NasUser = "fhipuer"
$NasHome = "/var/services/homes/fhipuer"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot
$deployStartedAt = Get-Date

$branch = (git branch --show-current).Trim()
if (-not $AllowNonMain -and $branch -ne "main") {
    throw "NAS production deployment requires the main branch; current branch is '$branch'."
}
if (-not $AllowDirty -and (git status --porcelain)) {
    throw "Working tree is dirty. Commit or stash changes before production deployment."
}

ssh -o BatchMode=yes -p $NasPort "$NasUser@$NasHostName" `
    "export PATH=/usr/local/bin:`$PATH; docker ps >/dev/null" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "NAS Docker access failed. Current NAS policy expects: sudo chmod 666 /var/run/docker.sock"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "meowney-deploy"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$archive = Join-Path $tempRoot "meowney-source.tar.gz"
$envUpload = "$NasHome/meowney.env.upload"

if ($DeployEnv -and -not (Test-Path -LiteralPath (Join-Path $RepoRoot ".env"))) {
    throw "-DeployEnv requires a local .env file at the repository root."
}

try {
    tar `
      --exclude=backend/data --exclude=backend/backups `
      --exclude=backend/__pycache__ --exclude=backend/.pytest_cache `
      --exclude=frontend/node_modules --exclude=frontend/dist `
      --exclude=frontend/test-results --exclude=frontend/playwright-report `
      -czf $archive `
      .env.example .gitignore CLAUDE.md README.md DESIGN.md DESIGN-tesla.md `
      docker-compose.yml backend database deploy docs frontend
    if ($LASTEXITCODE -ne 0) { throw "Source archive creation failed." }

    $sha = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    scp -O -P $NasPort $archive "$NasUser@${NasHostName}:$NasHome/meowney-source.tar.gz"
    if ($LASTEXITCODE -ne 0) { throw "Source upload failed." }
    scp -O -P $NasPort (Join-Path $PSScriptRoot "nas-apply-release.sh") `
        "$NasUser@${NasHostName}:$NasHome/nas-apply-release.sh"
    if ($LASTEXITCODE -ne 0) { throw "Release helper upload failed." }

    if ($DeployEnv) {
        scp -O -P $NasPort (Join-Path $RepoRoot ".env") `
            "$NasUser@${NasHostName}:$envUpload"
        if ($LASTEXITCODE -ne 0) { throw "Environment upload failed." }
    }

    $remoteEnvArg = if ($DeployEnv) { "'$envUpload'" } else { "''" }
    ssh -o BatchMode=yes -p $NasPort "$NasUser@$NasHostName" `
        "sed -i 's/\r$//' '$NasHome/nas-apply-release.sh' && chmod 700 '$NasHome/nas-apply-release.sh' && '$NasHome/nas-apply-release.sh' '$NasHome/meowney-source.tar.gz' '$sha' $remoteEnvArg"
    if ($LASTEXITCODE -ne 0) { throw "NAS release failed. Inspect NAS logs before retrying." }

    $health = Invoke-RestMethod -Uri "http://${NasHostName}:8000/health" -TimeoutSec 20
    $proxy = Invoke-WebRequest -UseBasicParsing -Uri "http://${NasHostName}:3000/api/v1/dashboard/portfolio" -TimeoutSec 20
    if ($health.status -ne "healthy" -or $proxy.StatusCode -ne 200) {
        throw "Post-deployment HTTP verification failed."
    }
    $elapsed = [math]::Round(((Get-Date) - $deployStartedAt).TotalSeconds)
    Write-Host "Meowney NAS deployment completed: branch=$branch health=$($health.status) elapsed=${elapsed}s"
}
finally {
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
}

