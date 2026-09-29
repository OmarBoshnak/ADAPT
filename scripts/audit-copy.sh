#!/usr/bin/env bash
#
# Copy + colour audit.
#
# The design spec is explicit that ADAPT never evaluates a body, never interprets a
# health condition, and never uses red. Those are safety requirements, not style
# preferences, so they fail the build rather than relying on a reviewer noticing.
#
# Run: npm run audit:copy

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

SEARCH_PATHS=(apps packages/core/src packages/data/src tools)

# Only ever look at source we author. Lock files in particular are a rich source of
# false positives — npm dependency names include words like "serialize-error".
EXCLUDES=(
  --include=*.ts
  --include=*.tsx
  --include=*.js
  --include=*.jsx
  --exclude=*.d.ts
  # Tests specify these rules, so they necessarily name the forbidden words.
  --exclude=*.test.ts
  --exclude=*.test.tsx
  --exclude=*.spec.ts
  --exclude=*.spec.tsx
  --exclude=package-lock.json
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=vendor
  --exclude-dir=.expo
  --exclude-dir=android
  --exclude-dir=ios
  --exclude-dir=coverage
)

# The audit governs USER-FACING COPY. Comments are not user-facing — and the files that
# define these rules necessarily quote the very words they forbid. So strip comment lines
# (`//`, `*`, `/*`, `#`) before judging. A forbidden word in a string literal still fails.
strip_comments() {
  grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*|#)'
}

# Developer diagnostics never reach a screen: thrown exceptions and console output. The
# word "error" in `throw new Error(...)` is an identifier, not adaptation copy.
strip_diagnostics() {
  grep -vE 'new Error\(|console\.(error|warn|log|info)\('
}

report() {
  local label="$1" pattern="$2" explanation="$3"
  local hits
  hits=$(grep -rniE "$pattern" "${SEARCH_PATHS[@]}" "${EXCLUDES[@]}" 2>/dev/null \
    | grep -viE '(audit-copy|FRICTION-LOG|PRODUCT-FEEDBACK|eslint\.config)' \
    | strip_comments | strip_diagnostics || true)
  if [[ -n "$hits" ]]; then
    echo "✗ $label"
    echo "  $explanation"
    echo "$hits" | sed 's/^/    /'
    echo
    FAIL=1
  else
    echo "✓ $label"
  fi
}

echo "ADAPT copy + colour audit"
echo "========================="
echo

# 1. The app never evaluates or judges the user's body.
report "no body-composition language" \
  '\b(BMI|body mass index|overweight|obese|obesity|calories? burned|calorie target|ideal weight)\b' \
  "Height and weight are inputs for movement selection only, never shown back as an assessment."

# 2. The app records medical conditions; it never interprets them.
report "no clinical/diagnostic language" \
  '\b(diagnos(is|e|ed)|symptom|prognosis|treat(ment|s)? (your|this)|medical advice is|you should consult because)\b' \
  "The interface records that a condition exists so movements can be excluded. It never explains or interprets one."

# 3. Adaptation is a calm coaching decision, never an error.
report "no alarm/error framing for adaptation" \
  '\b(warning|error|failure|alert|danger|your form is bad|incorrect form)\b' \
  "Amber signals an adaptive decision in progress. It is never an error or alarm state."

# 4. There is no camera in this product.
report "no camera or computer-vision claims" \
  '\b(computer vision|camera (feed|monitor|track)|visual form (check|recognition)|we watch you)\b' \
  "Movement quality comes from phone accelerometer and gyroscope signal only. Nothing observes the user visually."

# 5. Red is never used anywhere in this product.
RED_HITS=$(grep -rniE "#(f{2}|e[0-9a-f]|d[0-9a-f])(0|1|2|3)[0-9a-f](0|1|2|3)[0-9a-f]\b" \
  "${SEARCH_PATHS[@]}" "${EXCLUDES[@]}" 2>/dev/null \
  | grep -viE '(audit-copy|FF6B2C|FF8A52|FFC53D)' \
  | strip_comments || true)
if [[ -n "$RED_HITS" ]]; then
  echo "✗ no red in the palette"
  echo "  Red is never used anywhere in this product. Accent orange #FF6B2C and amber #FFC53D are not red."
  echo "$RED_HITS" | sed 's/^/    /'
  echo
  FAIL=1
else
  echo "✓ no red in the palette"
fi

echo
if [[ $FAIL -eq 0 ]]; then
  echo "All copy and colour checks passed."
else
  echo "Copy audit FAILED. These are safety requirements, not style notes — fix before committing."
fi
exit $FAIL
