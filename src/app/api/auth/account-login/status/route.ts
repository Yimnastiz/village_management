import { NextRequest, NextResponse } from "next/server";
import { accountLoginProblemResponse, publicAccountLoginFlow } from "@/lib/account-login-http";
import { getAccountLoginStatus } from "@/lib/account-login-service";
export async function GET(request: NextRequest) {
  try { return NextResponse.json(publicAccountLoginFlow(await getAccountLoginStatus(request.headers))); }
  catch (error) { return accountLoginProblemResponse(error); }
}
