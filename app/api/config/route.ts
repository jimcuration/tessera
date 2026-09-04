import { missingSecrets, readSwitches } from "@/lib/config";

export const dynamic = "force-dynamic";

/** The runtime switches and which secrets are missing (names only, never values). */
export async function GET() {
  return Response.json({ ...readSwitches(), missing: missingSecrets() });
}
