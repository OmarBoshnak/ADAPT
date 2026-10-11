# free-exercise-db-graph

Turns [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) into an **adaptation graph**. Each of its 876
exercises gets:

- an **intensity** score from 0 to 10, from the dataset's own fields;
- **mechanical tags** for filtering, such as `plyometric`, `deep-knee-flexion` or `overhead`;
- **`adaptsDownTo`**: a strictly easier version of the *same* movement, for when an exercise is too hard;
- **`substituteWith`**: a *different* movement for the same muscles, for when an exercise doesn't suit someone.

"Too hard" and "doesn't suit me" are different problems with different answers, which is why there are two edges.
Extracted from [ADAPT](../../README.md), an adaptive workout app for Fire TV, where both edges drive the workout
changing under you.

## Use

```bash
npm install free-exercise-db-graph
```

```ts
import { buildGraph, ladder } from 'free-exercise-db-graph';
import exercises from './exercises.json' with { type: 'json' }; // Free Exercise DB's dist/exercises.json

const graph = buildGraph(exercises);
graph.exercises['Single-Arm_Push-Up'];
// { intensity: 5.2, tags: ['prone', 'wrist-loading'], pattern: 'push-up', adaptsDownTo: 'Incline_Push-Up_Medium', … }

ladder(graph, 'Single-Arm_Push-Up').map((e) => e.name);
// hardest first, down the push-up ladder
```

Or from the command line:

```bash
npx free-exercise-db-graph exercises.json > graph.json
```

```bash
npx free-exercise-db-graph exercises.json --stats
# 876 exercises · step-down edges 157 (17.9%) · substitutes 723 (82.5%)
```

## How the edges are chosen

The edges are deliberately conservative. A missing edge is better than a wrong one: nobody wants to be told a jump
squat is an easier squat.

- **Step down** only within the same movement pattern (`squat`, `push-up`, `lunge`…), the same category and
  equipment, and exactly the same primary muscles. It must be at least 0.3 points easier, and it never adds a jump.
- **Substitute** with a different pattern in the same broad group (strength, conditioning or mobility), with
  overlapping muscles, no harder than half a point above, and again never by adding a jump.

## Honest limits

- **Intensity is relative, not physiological.** It orders movements within a pattern. It doesn't measure effort in
  any unit.
- **Some movements are identical in every field the dataset records.** For example, `Incline_Push-Up` and `Pushups`
  are both beginner, body-only and chest. They get the same score, because no formula over those fields can tell them
  apart. If you need them ordered, supply curated values.
- **Only 18% of exercises get a step-down edge.** Free Exercise DB is a gym corpus, and most of its exercises have no
  strictly easier peer with the same muscles and equipment. Treat a `null` as "no honest answer", not a bug.
- **Tags come from names and instructions.** They're generous on purpose: a false positive only removes a movement
  from someone's options.

## Licence

MIT. Free Exercise DB itself is released under the Unlicense.
