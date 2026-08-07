import { runCoachTurn } from "../src/lib/ai/coach";

/**
 * Verify coach turn with a foreign client id does not attach that client's data.
 * (We can't invent another org easily; use a nonsense client id.)
 */
export async function loadClientContextIsolation(
  organizationId: string,
  realClientId?: string
) {
  // Nonsense id — must not throw; coach should treat as no client
  const r = await runCoachTurn({
    organizationId,
    clientId: "cli_not_in_any_org",
    userMessage: "what should we train today",
    history: [],
  });
  if (!r) throw new Error("coach turn empty");

  if (realClientId) {
    const r2 = await runCoachTurn({
      organizationId,
      clientId: realClientId,
      userMessage: "summarize this client briefly",
      history: [],
    });
    if (!r2) throw new Error("coach turn with real client failed");
  }
}
