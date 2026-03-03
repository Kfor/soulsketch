// Regex-based first pass. These are intentionally strict — false positives
// are preferred over letting harmful content through. The API-based
// moderation (moderateWithAPI) provides more nuanced checks.
const BLOCKED_PATTERNS = [
  /\b(nude|naked|nsfw|porn|xxx)\b/i,
  /\bsexual\b/i,
  /\b(underage)\b/i,
  /\b(harass|stalk|threat|violen(?:t|ce))\b/i,
  /\b(kill|murder|assault|abuse)\b/i,
];

export interface ModerationResult {
  passed: boolean;
  reason?: string;
}

export function moderateText(text: string): ModerationResult {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        passed: false,
        reason:
          "Your message contains content that isn't allowed. Please keep the conversation appropriate.",
      };
    }
  }
  return { passed: true };
}

export async function moderateWithAPI(
  text: string,
): Promise<ModerationResult> {
  // First check local patterns
  const localCheck = moderateText(text);
  if (!localCheck.passed) return localCheck;

  const apiKey = process.env.MODERATION_API_KEY;
  if (!apiKey) return { passed: true };

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    // Design decision: fail open on API errors to prioritize availability.
    // Regex patterns still provide baseline protection. Monitor API error
    // rates in production and consider failing closed if abuse is detected.
    if (!response.ok) return { passed: true };

    const data = await response.json();
    const result = data.results?.[0];

    if (result?.flagged) {
      return {
        passed: false,
        reason:
          "Your message was flagged by our content filter. Please keep things appropriate.",
      };
    }

    return { passed: true };
  } catch {
    return { passed: true }; // Fail open
  }
}
