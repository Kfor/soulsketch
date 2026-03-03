export interface ImageGenerationResult {
  url: string;
  revised_prompt?: string;
}

export async function generatePortrait(
  prompt: string,
): Promise<ImageGenerationResult> {
  const apiKey = process.env.AI_IMAGE_API_KEY;
  const apiUrl =
    process.env.AI_IMAGE_API_URL ||
    "https://api.openai.com/v1/images/generations";

  if (!apiKey) {
    // Return a placeholder when no API key is configured
    return {
      url: createPlaceholderDataUrl(prompt),
      revised_prompt: prompt,
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `${prompt}. Style: high-quality digital portrait illustration, warm lighting, soft colors.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Image API error:", response.status, errorText);
    return {
      url: createPlaceholderDataUrl(prompt),
      revised_prompt: prompt,
    };
  }

  const data = await response.json();
  return {
    url: data.data[0].url,
    revised_prompt: data.data[0].revised_prompt,
  };
}

export async function refinePortrait(
  originalUrl: string,
  refinementPrompt: string,
): Promise<ImageGenerationResult> {
  // For MVP, we regenerate with an enhanced prompt instead of true img2img
  // True img2img would require different API endpoints depending on provider
  return generatePortrait(refinementPrompt);
}

function createPlaceholderDataUrl(_prompt: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#7c3aed"/>
        <stop offset="100%" style="stop-color:#f472b6"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#bg)" rx="24"/>
    <text x="256" y="240" text-anchor="middle" fill="white" font-size="20" font-family="sans-serif">AI Portrait</text>
    <text x="256" y="280" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="14" font-family="sans-serif">(Configure AI_IMAGE_API_KEY)</text>
  </svg>`)}`;
}
