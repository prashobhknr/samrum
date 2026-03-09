# Run this script as Administrator to restore pg_hba.conf after password reset
# The password has already been reset and DB created. This just restores scram-sha-256 auth.

$ErrorActionPreference = "Stop"

$hba = "C:\Program Files\PostgreSQL\14\data\pg_hba.conf"
$backup = "C:\Program Files\PostgreSQL\14\data\pg_hba.conf.bak"

Write-Host "=== Restoring original pg_hba.conf ===" -ForegroundColor Yellow
Stop-Service postgresql-x64-14 -Force
Start-Sleep -Seconds 3

if (Test-Path $backup) {
    Copy-Item $backup $hba -Force
    Write-Host "Restored from backup"
} else {
    Write-Host "No backup found, writing scram-sha-256 config"
    $conf = "# TYPE  DATABASE        USER            ADDRESS                 METHOD`r`n" +
        "local   all             all                                     scram-sha-256`r`n" +
        "host    all             all             127.0.0.1/32            scram-sha-256`r`n" +
        "host    all             all             ::1/128                 scram-sha-256`r`n" +
        "local   replication     all                                     scram-sha-256`r`n" +
        "host    replication     all             127.0.0.1/32            scram-sha-256`r`n" +
        "host    replication     all             ::1/128                 scram-sha-256`r`n"
    [System.IO.File]::WriteAllText($hba, $conf, (New-Object System.Text.UTF8Encoding $false))
}

Start-Service postgresql-x64-14
Start-Sleep -Seconds 5
Write-Host "PostgreSQL restarted with password auth"

# Verify
$env:Path = "C:\Program Files\PostgreSQL\14\bin;$env:Path"
$env:PGPASSWORD = "doorman_pass"
$result = & psql -h 127.0.0.1 -U doorman_user -d doorman_db -w -c "SELECT 'CONNECTION_OK' as status;" 2>&1
if ("$result" -match "CONNECTION_OK") {
    Write-Host "SUCCESS! doorman_user can connect to doorman_db with password 'doorman_pass'" -ForegroundColor Green
} else {
    Write-Host "Verify result: $result" -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"

Write-Host "`n=== Step 5: Test trust connection ===" -ForegroundColor Yellow
# Explicitly connect via TCP to 127.0.0.1
$env:PGPASSWORD = ""
$testResult = & psql -h 127.0.0.1 -U postgres -w -c "SELECT 'TRUST_OK' as status;" 2>&1
Write-Host "Raw output:"
$testResult | ForEach-Object { Write-Host "  $_" }

if ("$testResult" -match "TRUST_OK") {
    Write-Host "`nTrust auth WORKS!" -ForegroundColor Green
} else {
    Write-Host "`nTrust auth FAILED." -ForegroundColor Red
    Write-Host "Restoring backup and exiting..."
    Stop-Service postgresql-x64-14 -Force
    Start-Sleep -Seconds 2
    Copy-Item $backup $hba -Force
    Start-Service postgresql-x64-14
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "`n=== Step 6: Reset postgres password ===" -ForegroundColor Yellow
& psql -h 127.0.0.1 -U postgres -w -c "ALTER USER postgres WITH PASSWORD 'doorman_pass';"
Write-Host "Password set to: doorman_pass"

Write-Host "`n=== Step 7: Restore original pg_hba.conf ===" -ForegroundColor Yellow
Stop-Service postgresql-x64-14 -Force
Start-Sleep -Seconds 3
Copy-Item $backup $hba -Force
Start-Service postgresql-x64-14
Write-Host "Waiting 8 seconds for full startup..."
Start-Sleep -Seconds 8
Write-Host "Original pg_hba.conf restored, PostgreSQL restarted"

Write-Host "`n=== Step 8: Verify with new password ===" -ForegroundColor Yellow
$env:PGPASSWORD = "doorman_pass"
$verifyResult = & psql -h 127.0.0.1 -U postgres -w -c "SELECT 'CONNECTION_OK' as status;" 2>&1
Write-Host "Raw output:"
$verifyResult | ForEach-Object { Write-Host "  $_" }

if ("$verifyResult" -match "CONNECTION_OK") {
    Write-Host "`nSUCCESS! PostgreSQL password is now 'doorman_pass'" -ForegroundColor Green
} else {
    Write-Host "`nPassword verify FAILED" -ForegroundColor Red
}

Write-Host "`nDone! You can close this window." -ForegroundColor Cyan
Read-Host "Press Enter to exit"
