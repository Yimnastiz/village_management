$ErrorActionPreference = "Stop"

$root = "c:\Users\Gamep\Desktop\workspace\Yim-Project1"
$runId = Get-Date -Format "yyyyMMddHHmmss"
$outLog = Join-Path $root "tmp-next-start-$runId.log"
$errLog = Join-Path $root "tmp-next-start-$runId.err.log"

$seedResultRaw = @'
const { PrismaClient, VillageMembershipRole } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const village = await prisma.village.upsert({
    where: { slug: "dev-smoke-village" },
    update: {
      name: "Dev Smoke Village",
      province: "Bangkok",
      district: "Sai Mai",
      subdistrict: "O Ngoen",
      isActive: true,
    },
    create: {
      slug: "dev-smoke-village",
      name: "Dev Smoke Village",
      province: "Bangkok",
      district: "Sai Mai",
      subdistrict: "O Ngoen",
      isActive: true,
    },
  });

  await prisma.phoneRoleSeed.upsert({
    where: { phoneNumber: "+66881111111" },
    update: {
      villageId: village.id,
      membershipRole: VillageMembershipRole.HEADMAN,
      isCitizenVerified: true,
    },
    create: {
      phoneNumber: "+66881111111",
      villageId: village.id,
      membershipRole: VillageMembershipRole.HEADMAN,
      isCitizenVerified: true,
    },
  });

  console.log(JSON.stringify({ villageId: village.id }));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
'@ | node -

$seedResult = $seedResultRaw | ConvertFrom-Json
$villageId = $seedResult.villageId

$proc = Start-Process `
  -FilePath "npm.cmd" `
  -ArgumentList @("run", "start", "--", "-p", "3110") `
  -WorkingDirectory $root `
  -PassThru `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

Start-Sleep -Seconds 8

$base = "http://127.0.0.1:3110"

function Get-LatestOtp([string]$phone) {
  $otp = ""
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 400
    if (Test-Path $outLog) {
      $match = Select-String `
        -Path $outLog `
        -Pattern "\[OTP\]\s+$([regex]::Escape($phone)):\s+(\d{6})" |
        Select-Object -Last 1
      if ($match) {
        $otp = $match.Matches[0].Groups[1].Value
        break
      }
    }
  }

  if (-not $otp) {
    throw "OTP not found for phone $phone"
  }

  return $otp
}

function SignInWithOtp([string]$phone) {
  $sendRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri "$base/api/auth/phone-number/send-otp" `
    -ContentType "application/json" `
    -Body (@{ phoneNumber = $phone } | ConvertTo-Json)

  $otp = Get-LatestOtp $phone
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $verifyRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri "$base/api/auth/phone-number/verify" `
    -ContentType "application/json" `
    -Body (@{ phoneNumber = $phone; code = $otp } | ConvertTo-Json) `
    -WebSession $session

  return [PSCustomObject]@{
    sendStatus = [int]$sendRes.StatusCode
    verifyStatus = [int]$verifyRes.StatusCode
    session = $session
  }
}

try {
  $bootstrapPhone = "+66800000000"
  $bootstrapSignIn = SignInWithOtp $bootstrapPhone
  $bootstrapLandingRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Get `
    -Uri "$base/api/auth/post-login-route" `
    -WebSession $bootstrapSignIn.session
  $bootstrapLanding = ($bootstrapLandingRes.Content | ConvertFrom-Json).landingPath

  $headmanPhone = "+66881111111"
  $headmanSignIn = SignInWithOtp $headmanPhone
  $headmanLandingRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Get `
    -Uri "$base/api/auth/post-login-route" `
    -WebSession $headmanSignIn.session
  $headmanLanding = ($headmanLandingRes.Content | ConvertFrom-Json).landingPath

  $residentPhone = "+6699" + (Get-Random -Minimum 10000000 -Maximum 99999999)
  $residentSignIn = SignInWithOtp $residentPhone
  $completeSignupRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri "$base/api/auth/complete-signup" `
    -ContentType "application/json" `
    -Body (@{
      name = "Smoke Resident"
      province = "Bangkok"
      district = "Sai Mai"
      subdistrict = "O Ngoen"
      villageId = $villageId
    } | ConvertTo-Json) `
    -WebSession $residentSignIn.session
  $completeSignupData = $completeSignupRes.Content | ConvertFrom-Json

  $residentLandingRes = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Get `
    -Uri "$base/api/auth/post-login-route" `
    -WebSession $residentSignIn.session
  $residentLanding = ($residentLandingRes.Content | ConvertFrom-Json).landingPath

  [PSCustomObject]@{
    bootstrap = [PSCustomObject]@{
      sendOtp = $bootstrapSignIn.sendStatus
      verify = $bootstrapSignIn.verifyStatus
      landing = $bootstrapLanding
    }
    headman = [PSCustomObject]@{
      sendOtp = $headmanSignIn.sendStatus
      verify = $headmanSignIn.verifyStatus
      landing = $headmanLanding
    }
    residentSignup = [PSCustomObject]@{
      sendOtp = $residentSignIn.sendStatus
      verify = $residentSignIn.verifyStatus
      completeSignupStatus = [int]$completeSignupRes.StatusCode
      completeSignupLanding = $completeSignupData.landingPath
      postLoginLanding = $residentLanding
      citizenVerified = $completeSignupData.citizenVerified
      membershipStatus = $completeSignupData.membershipStatus
    }
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
