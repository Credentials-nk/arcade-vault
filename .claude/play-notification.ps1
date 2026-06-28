Add-Type -AssemblyName presentationCore
$mp = New-Object system.windows.media.mediaplayer
$mp.open([uri]'file:///C:/Users/PC2026/Develop/claude-course-devtalles/arcade-vault/references/claudecode-finished.mp3')
$mp.Play()
Start-Sleep -Milliseconds 500
$end = [DateTime]::Now.AddSeconds(15)
while ([DateTime]::Now -lt $end) {
    if ($mp.NaturalDuration.HasTimeSpan -and $mp.Position -ge $mp.NaturalDuration.TimeSpan) { break }
    Start-Sleep -Milliseconds 200
}
$mp.Close()
