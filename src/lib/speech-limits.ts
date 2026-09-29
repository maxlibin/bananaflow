// Normal narration runs ~0.065s per character. Speech well beyond this bound
// means the model did something other than read the line (e.g. followed an
// instruction hidden in it): providers cap their output to it and the speech
// route rejects anything longer.
export const MAX_SPEECH_SECONDS_PER_CHARACTER = 0.15;
export const SPEECH_SECONDS_SLACK = 3;

export function maxSpeechSeconds(characters: number): number {
  return characters * MAX_SPEECH_SECONDS_PER_CHARACTER + SPEECH_SECONDS_SLACK;
}
