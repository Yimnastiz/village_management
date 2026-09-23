import { NextRequest, NextResponse } from "next/server";
import {
  houseLoginProblemResponse,
  publicHouseLoginFlow,
} from "@/lib/house-account-login-http";
import { getHouseAccountLoginStatus } from "@/lib/house-account-login-service";

export async function GET(request: NextRequest) {
  try {
    const flow = await getHouseAccountLoginStatus(request.headers);
    return NextResponse.json(publicHouseLoginFlow(flow));
  } catch (error) {
    return houseLoginProblemResponse(error);
  }
}
