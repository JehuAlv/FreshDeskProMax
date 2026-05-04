$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
$proxyPath = "$PSScriptRoot\proxy.py"

function Start-Ollama {
    $env:OLLAMA_HOST = "0.0.0.0"
    $env:OLLAMA_ORIGINS = "*"
    Start-Process -FilePath $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
}

function Start-Proxy {
    Start-Process -FilePath "python" -ArgumentList $proxyPath -WindowStyle Hidden
}

function Test-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

Start-Ollama
Start-Proxy
Start-Sleep -Seconds 5

while ($true) {
    if (-not (Test-Port 11434)) {
        Get-Process ollama* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-Ollama
    }
    if (-not (Test-Port 8080)) {
        Start-Proxy
    }
    Start-Sleep -Seconds 10
}
