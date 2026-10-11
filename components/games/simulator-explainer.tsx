import type { SimulatorExplainerContent } from '@/lib/games-seo-content';

export function SimulatorExplainer({ explainer }: { explainer: SimulatorExplainerContent }) {
  return (
    <section className="w-full my-10 max-w-3xl" aria-labelledby="simulator-explainer">
      <h2 id="simulator-explainer" className="text-lg font-semibold mb-3">
        Overview
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{explainer.summary}</p>

      <h3 className="text-base font-semibold mt-6 mb-2">Try this</h3>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
        {explainer.tryThis.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h3 className="text-base font-semibold mt-6 mb-2">Frequently asked questions</h3>
      <dl className="space-y-4 text-sm">
        {explainer.faq.map((item) => (
          <div key={item.question}>
            <dt className="font-medium text-foreground">{item.question}</dt>
            <dd className="mt-1 text-muted-foreground leading-relaxed">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
