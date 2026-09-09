export type Profile = { name: string; age: string; start: string };
export const profileKey = 'reading-profile-v1';
export function parseProfile(raw: string | null): Profile | null {
  try {
    const p = JSON.parse(raw || 'null');
    return p &&
      typeof p.name === 'string' &&
      p.name.trim().length > 0 &&
      p.name.length <= 30 &&
      typeof p.age === 'string' &&
      ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12+'].includes(p.age) &&
      [
        'letters',
        'syllables',
        'words',
        'pictures',
        'sentences',
        'stories',
        'poems',
      ].includes(p.start)
      ? p
      : null;
  } catch {
    return null;
  }
}
