// Pure JS (no browser APIs) - shared by the browser fallback and the Fastify route when Person B's generateNotes isn't there yet.
export function buildCannedNote(moment, format) {
  const sentences = (moment.reexplanation || '').split(/(?<=[.!?])\s+/).filter(Boolean)
  const key = (moment.evidenceQuote || moment.passage || '').slice(0, 60)
  switch (format) {
    case 'flashcards':
      return { format, content: [
        { front: 'What was confusing here?', back: moment.summary || moment.whyConfusing || '' },
        { front: 'Explain it in one line', back: sentences[0] || moment.reexplanation },
        { front: 'Worked example', back: moment.example },
      ] }
    case 'diagram':
      return { format, content: `flowchart TD\n  A["${key.replace(/"/g, "'")}..."] --> B["Stop condition: base case"]\n  B --> C["Return a direct answer"]\n  C --> D["Paused calls finish, inside out"]\n  D --> E["Final answer"]` }
    case 'bullets':
      return { format, content: [...sentences, moment.example].filter(Boolean).slice(0, 5) }
    default:
      return { format: 'plain', content: `${moment.reexplanation} For example: ${moment.example}` }
  }
}
