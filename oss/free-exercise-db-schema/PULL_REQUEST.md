# Pull request: add a JSON Schema for `exercises.json`

Prepared for [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db). To open it: fork the
repository, add `exercise.schema.json` at `schema/exercise.schema.json`, and use the text below as the description.

---

## Add a JSON Schema for exercise records

This adds `schema/exercise.schema.json`, a JSON Schema (draft 2020-12) for one record in `dist/exercises.json`. It
pins down what consumers currently infer: the allowed values of `force`, `level`, `mechanic`, `equipment` and
`category`, the 17 muscle names, the image path shape, and that `id` matches the directory under `exercises/`.

### What it found

Validated against all 876 records at `a859101`, it reports two problems:

- `Barbell_Squat_To_A_Bench`: instruction 2 of 8 is an empty string.
- `Clean`: instruction 2 of 6 is an empty string.

Both look like stray blank lines from the source text. Happy to remove them in this PR if you'd like.

### Nulls are allowed, and documented

`force` (30 records), `mechanic` (87) and `equipment` (77) are sometimes `null`. The schema allows `null` and
describes it as "not recorded", because several are genuinely ambiguous: `Bicycling` has no single force, and
`Arm_Circles` uses no equipment, but neither does any record marked `body only`. Normalizing those values is a
judgment call for maintainers, so this PR only makes the current contract explicit.

### Why

We built an adaptive workout app on this dataset, along with
[free-exercise-db-graph](https://www.npmjs.com/package/free-exercise-db-graph), which derives difficulty ladders
from it. A schema would have saved a pass of discovering the enums and nulls by hand, and it lets downstream projects
validate the dataset in CI when they update their copy.

No data files are changed.
