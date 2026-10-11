// Names the forbidden words by necessity, so the copy audit skips this file like it skips eslint.config.js.

/** Language a generated sentence may never use. Mirrors scripts/audit-copy.sh, plus what only a model would write. */
export const COPY_RULES: readonly string[] = [
  '\\b(BMI|body mass index|overweight|obese|obesity|calories?|body fat|weight loss|lose weight|ideal weight|out of shape)\\b',
  '\\b(diagnos(is|e|ed)|symptoms?|prognosis|medical|doctor|physician|injur(y|ies|ed)|conditions?|pain(ful)?)\\b',
  '\\b(warning|error|failure|failed|alert|danger(ous)?|bad form|poor form|incorrect form|weak|lazy)\\b',
  '\\b(camera|computer vision|watch(ed|ing)? you|saw you)\\b',
  '(https?://|[*#`<>])',
];

const RULES = COPY_RULES.map((source) => new RegExp(source, 'i'));
const MAX_GENERATED_LENGTH = 200;

export function isSafeCopy(text: string): boolean {
  return text.length > 0 && text.length <= MAX_GENERATED_LENGTH && !RULES.some((rule) => rule.test(text));
}
