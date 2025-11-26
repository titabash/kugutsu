/**
 * Mock for pkce-challenge ESM module
 */

export default function pkceChallenge(): { code_verifier: string; code_challenge: string } {
  return {
    code_verifier: 'mock-code-verifier',
    code_challenge: 'mock-code-challenge',
  };
}

export function generateChallenge(): string {
  return 'mock-challenge';
}

export function verifyChallenge(): boolean {
  return true;
}
