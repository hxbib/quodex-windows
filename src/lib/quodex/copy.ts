import { isNativeApp } from "@/lib/openai/api";

export function loginFootnote(): string {
  return isNativeApp()
    ? "Quodex stores this account’s tokens in a Windows DPAPI vault on this PC. It does not read or modify the official ChatGPT app, browser cookies, or retry an expired session."
    : "This live Windows 11 page uses sample accounts. Tokens are not stored here. Download the installer to sign in — sessions are sealed with Windows DPAPI and expired tokens are never retried.";
}

export function emptyFootnote(): string {
  return isNativeApp()
    ? "Sessions live in a DPAPI-sealed vault under %APPDATA%\\Quodex. Quodex does not read the official ChatGPT app or retry expired tokens."
    : "This website is a live desktop preview with sample data. Download the installer for DPAPI-backed sessions on your PC.";
}

export function removeCopy(email: string): string {
  return isNativeApp()
    ? `This removes ${email} and its DPAPI-sealed session from this PC. It does not sign the ChatGPT account out elsewhere.`
    : `This removes ${email} from the sample desktop. This website never holds a ChatGPT session.`;
}
