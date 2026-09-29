export type VoiceCommand = 'easier' | 'harder' | 'swap' | 'pause';

export interface HeardCommand {
  command: VoiceCommand;
  heard: string;
}

export const PHRASES: ReadonlyArray<{ command: VoiceCommand; phrase: string; aliases?: string[] }> = [
  { command: 'easier', phrase: 'easier' },
  { command: 'harder', phrase: 'harder' },
  { command: 'swap', phrase: 'swap this', aliases: ['swap it', 'swap'] },
  { command: 'pause', phrase: 'pause', aliases: ['paws'] },
];

const MIN_SIMILARITY = 0.8;
const CONFIDENCE_FLOOR = 0.3;
const TAIL_WORDS = 4;

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min((prev[j] as number) + 1, (row[j - 1] as number) + 1, (prev[j - 1] as number) + cost));
    }
    prev = row;
  }
  return prev[b.length] as number;
}

const similarity = (a: string, b: string) => 1 - distance(a, b) / Math.max(a.length, b.length);

/**
 * Only the latest words count: partial transcripts grow, and earlier words were already judged.
 * Recognisers report 0 or -1 when they have no confidence; only a real low score rejects.
 */
export function matchCommand(transcript: string, confidence = -1): HeardCommand | null {
  if (confidence > 0 && confidence < CONFIDENCE_FLOOR) return null;
  const words = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-TAIL_WORDS);

  let best: { command: VoiceCommand; phrase: string; score: number } | null = null;
  for (const { command, phrase, aliases = [] } of PHRASES) {
    for (const form of [phrase, ...aliases]) {
      const size = form.split(' ').length;
      for (let i = 0; i + size <= words.length; i++) {
        const score = similarity(words.slice(i, i + size).join(' '), form);
        if (score >= MIN_SIMILARITY && (!best || score > best.score)) best = { command, phrase, score };
      }
    }
  }
  return best && { command: best.command, heard: best.phrase };
}
