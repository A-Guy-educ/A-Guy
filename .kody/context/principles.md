# Principles

How A-Guy is built and how decisions get made:

**AI as infrastructure, not a feature.** AI is woven into the core — context,
memory, retrieval — rather than added as a separate chatbot. The tutor is the
interface, not a widget beside it.

**Content as data, not pages.** Educational material is structured data that can
be transformed, queried, and AI-processed. The Exercise is the atom; content is
decomposed into blocks and tagged with context layers (lesson, exercise,
diagram) for precise retrieval. PDFs are raw material for extraction, not the
end product.

**"Everything is Data — incrementally."** The vision is fully CMS-driven, but
execution is deliberate and staged. We don't break a working system or do
ideological rewrites; each step moves more of the platform toward CMS-driven
without a big-bang. That's engineering maturity, not a shortcut.

**Minimalist by intent.** Few tools, full control, real depth. The stack is kept
deliberately small (e.g. real vector search in MongoDB Atlas, not a toy) and the
design language is unified (Tailwind + shadcn/ui) to avoid sprawl and CSS
spaghetti.

**Depth over breadth.** Get the core learning + tutoring loop genuinely right
before widening surface area.
