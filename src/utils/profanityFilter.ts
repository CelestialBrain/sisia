const PROFANITY_LIST = [
  'fuck', 'shit', 'damn', 'bitch', 'ass', 'bastard', 'cunt', 'dick', 
  'pussy', 'cock', 'piss', 'slut', 'whore', 'fag', 'nigger', 'nigga',
  'retard', 'crap', 'hell'
];

export function filterProfanity(text: string): string {
  if (!text) return text;
  
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
  });
  
  return filtered;
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  
  return PROFANITY_LIST.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(text);
  });
}
