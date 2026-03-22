$ErrorActionPreference = "Stop"

$root = "c:\Users\Gamep\Desktop\workspace\Yim-Project1"
$outLog = Join-Path $root "tmp-next-start.log"
$errLog = Join-Path $root "tmp-next-start.err.log"

if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

$proc = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList @("run", "start", "--", "-p", "3108") `
  -WorkingDirectory $root `
  -PassThru `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

Start-Sleep -Seconds 8

$base = "http://127.0.0.1:3108"

try {
  $anonSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $preStatus = $null
  $preLocation = $null

  try {
    $preResponse = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "$base/resident/dashboard" `
      -MaximumRedirection 0 `
      -WebSession $anonSession
    $preStatus = [int]$preResponse.StatusCode
    $preLocation = $preResponse.Headers.Location
  } catch {
    if ($_.Exception.Response) {
      $preStatus = [int]$_.Exception.Response.StatusCode
      $preLocation = $_.Exception.Response.Headers["Location"]
    } else {
      throw
    }
  }

  $phone = "+6698" + (Get-Random -Minimum 1000000 -Maximum 9999999)
  $sendOtpBody = @{ phoneNumber = $phone } | ConvertTo-Json
  $sendOtpResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri "$base/api/auth/phone-number/send-otp" `
    -ContentType "application/json" `
    -Body $sendOtpBody

  $otp = ""
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 400
    if (Test-Path $outLog) {
      $otpMatch = Select-String `
        -Path $outLog `
        -Pattern "\[OTP\]\s+$([regex]::Escape($phone)):\s+(\d{6})" |
        Select-Object -Last 1

      if ($otpMatch) {
        $otp = $otpMatch.Matches[0].Groups[1].Value
        break
      }
    }
  }

  if (-not $otp) {
    throw "OTP was not found in server log."
  }

  $invalidOtp = if ($otp.Substring(5, 1) -eq "0") {
    $otp.Substring(0, 5) + "1"
  } else {
    $otp.Substring(0, 5) + "0"
  }

  $invalidOtpStatus = $null
  try {
    Invoke-WebRequest `
      -UseBasicParsing `
      -Method Post `
      -Uri "$base/api/auth/phone-number/verify" `
      -ContentType "application/json" `
      -Body (@{ phoneNumber = $phone; code = $invalidOtp } | ConvertTo-Json) |
      Out-Null
    $invalidOtpStatus = "unexpected-200"
  } catch {
    if ($_.Exception.Response) {
      $invalidOtpStatus = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }

  $authSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $verifyResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri "$base/api/auth/phone-number/verify" `
    -ContentType "application/json" `
    -Body (@{ phoneNumber = $phone; code = $otp } | ConvertTo-Json) `
    -WebSession $authSession

  $authStatus = $null
  $authLocation = $null
  try {
    $authResponse = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "$base/resident/dashboard" `
      -MaximumRedirection 0 `
      -WebSession $authSession
    $authStatus = [int]$authResponse.StatusCode
    $authLocation = $authResponse.Headers.Location
  } catch {
    if ($_.Exception.Response) {
      $authStatus = [int]$_.Exception.Response.StatusCode
      $authLocation = $_.Exception.Response.Headers["Location"]
    } else {
      throw
    }
  }

  $signOutStatus = $null
  try {
    $signOutResponse = Invoke-WebRequest `
      -UseBasicParsing `
      -Method Post `
      -Uri "$base/api/auth/sign-out" `
      -ContentType "application/json" `
      -Body "{}" `
      -Headers @{ Origin = "http://localhost:3000"; Referer = "http://localhost:3000/" } `
      -WebSession $authSession
    $signOutStatus = [int]$signOutResponse.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $signOutStatus = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }

  $postSignOutStatus = $null
  $postSignOutLocation = $null
  try {
    $postSignOutResponse = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "$base/resident/dashboard" `
      -MaximumRedirection 0 `
      -WebSession $authSession
    $postSignOutStatus = [int]$postSignOutResponse.StatusCode
    $postSignOutLocation = $postSignOutResponse.Headers.Location
  } catch {
    if ($_.Exception.Response) {
      $postSignOutStatus = [int]$_.Exception.Response.StatusCode
      $postSignOutLocation = $_.Exception.Response.Headers["Location"]
    } else {
      throw
    }
  }

  [PSCustomObject]@{
    unauthResidentStatus  = $preStatus
    unauthRedirect        = $preLocation
    sendOtpStatus         = [int]$sendOtpResponse.StatusCode
    invalidOtpStatus      = $invalidOtpStatus
    verifyStatus          = [int]$verifyResponse.StatusCode
    authResidentStatus    = $authStatus
    authRedirect          = $authLocation
    signOutStatus         = $signOutStatus
    postSignOutStatus     = $postSignOutStatus
    postSignOutRedirect   = $postSignOutLocation
    otpLogged             = ($otp.Length -eq 6)
    phone                 = $phone
  } | ConvertTo-Json -Compress
}
finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }

  Start-Sleep -Milliseconds 500
  Write-Output "---SERVER-OUT---"
  if (Test-Path $outLog) { Get-Content $outLog }
  Write-Output "---SERVER-ERR---"
  if (Test-Path $errLog) { Get-Content $errLog }
}
