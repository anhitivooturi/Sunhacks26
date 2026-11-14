// Mock report in the exact contract shape, plus the PROPOSED optional fields.
// Person D's /fixtures/report.json replaces this once it exists. Evidence quotes are exact substrings of passages.

const passage1 =
  "So once we have the recursive call, we just memoize it and the exponential blowup goes away. You store the subproblem results and the tree collapses into a line, which is why fib of 50 suddenly runs instantly.";
const passage2 =
  "Then the base case handles the rest. Since fib of n calls fib of n minus one and n minus two, and we've proven termination by induction on n, the total work is linear in n.";

export const mockReport = {
  sessionId: 'demo',
  durationSec: 492,
  participants: 23,
  topics: [
    { start: 0, end: 140, title: 'What recursion is', confusion: 0.08, questions: 1, understanding: 0.82 },
    { start: 140, end: 330, title: 'Fibonacci and memoization', confusion: 0.41, questions: 4, understanding: 0.38 },
    { start: 330, end: 492, title: 'Proving it terminates', confusion: 0.26, questions: 2, understanding: 0.55 },
  ],
  moments: [
    {
      id: 'm1',
      startSec: 198,
      endSec: 222,
      score: 0.41,
      lostCount: 9,
      active: 22,
      confidence: 'high',
      passage: passage1,
      whyConfusing: 'undefined_term',
      summary: '"Memoize" was used before it was explained, so students could not follow why the code got faster.',
      evidenceQuote: 'we just memoize it and the exponential blowup goes away',
      reexplanation:
        'Memoizing means saving each answer the first time you compute it, so the next time you need fib(30) you look it up instead of recomputing it. That turns millions of repeated calls into about n calls.',
      example:
        'Without memoization, fib(5) computes fib(3) twice and fib(2) three times. With a dictionary {2: 1, 3: 2, ...}, each value is computed once and reused.',
      quiz: [
        {
          q: 'What does memoization store?',
          options: ['The call stack', 'Results of subproblems already solved', 'The base case', 'Every line of the function'],
          answerIndex: 1,
          explanation: 'Memoization caches results so repeated subproblems are looked up, not recomputed.',
        },
        {
          q: 'Why does memoized fib(50) run quickly?',
          options: ['It uses a faster language', 'It skips the base case', 'Each fib(k) is computed only once', 'It runs in parallel'],
          answerIndex: 2,
          explanation: 'Each subproblem is solved once, so the work grows linearly instead of exponentially.',
        },
        {
          q: 'Without memoization, how many times is fib(2) computed inside fib(5)?',
          options: ['Once', 'Twice', 'Three times', 'Five times'],
          answerIndex: 2,
          explanation: 'The recursion tree for fib(5) contains fib(2) three times.',
        },
      ],
      resolved: 0.81,
      quizAnswered: 21,
    },
    {
      id: 'm2',
      startSec: 351,
      endSec: 368,
      score: 0.26,
      lostCount: 6,
      active: 23,
      confidence: 'medium',
      passage: passage2,
      whyConfusing: 'skipped_step',
      summary: 'The jump from "base case" to "linear work" skipped how the induction argument actually works.',
      evidenceQuote: "we've proven termination by induction on n",
      reexplanation:
        'Every call makes n smaller, and n cannot go below the base case, so the calls must stop. With memoization, each n from 0 to N is solved once, which is why the total work is linear.',
      example: 'fib(4) → fib(3) → fib(2) → fib(1): n drops by at least 1 each step and stops at 1 or 0.',
      quiz: [
        {
          q: 'Why must the recursion eventually stop?',
          options: ['The computer runs out of memory', 'n gets smaller each call and hits the base case', 'Python limits recursion', 'Memoization stops it'],
          answerIndex: 1,
          explanation: 'Each call reduces n, and the base case ends the chain.',
        },
        {
          q: 'With memoization, how many distinct subproblems does fib(n) solve?',
          options: ['About n', 'About 2^n', 'About n^2', 'Exactly 2'],
          answerIndex: 0,
          explanation: 'There is one subproblem for each value from 0 to n.',
        },
        {
          q: 'What does the base case do?',
          options: ['Returns an answer without recursing', 'Calls the function twice', 'Stores results', 'Proves induction'],
          answerIndex: 0,
          explanation: 'The base case answers directly, which stops the recursion.',
        },
      ],
      resolved: null,
      quizAnswered: 0,
    },
  ],
  unanswered: [
    { id: 'q3', text: 'Is memoization the same as dynamic programming?', upvotes: 7 },
    { id: 'q5', text: 'Does Python have a built-in way to memoize?', upvotes: 4 },
  ],
  recap:
    "Last class I said \"just memoize it\" without explaining it, and a lot of you got lost there. Memoizing means saving each answer the first time you compute it so you never compute it twice. That is the whole reason fib(50) became instant. I also skipped a step in the termination proof: n shrinks every call and stops at the base case. Two good questions came up that we'll start with today: whether memoization is dynamic programming, and how to do it in Python with functools.cache.",
  deliveryStats: {
    wordsPerMinute: 171,
    longestStretchWithoutExampleSec: 214,
    jargonBeforeDefinition: ['memoize', 'induction'],
  },
};
