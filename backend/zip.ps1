$src = 'C:\Users\i7\link-organizer\backend\handler.js'
$dst = 'C:\Users\i7\link-organizer\backend\function.zip'
Compress-Archive -LiteralPath $src -DestinationPath $dst -Force
Write-Host "Done: $((Get-Item $dst).Length) bytes"
