export const WEB_AUTH_DISABLED =
  "ChatGPT sign-in is not available on this website. Download Quodex for Windows.";

export function refuseWebOpenAI(): never {
  throw new Error(WEB_AUTH_DISABLED);
}
