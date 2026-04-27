/**
 * Server-rendered content block for game pages.
 *
 * Provides indexable HTML for AI crawlers that don't execute JavaScript.
 * Renders as a visually hidden section (sr-only) so it doesn't affect
 * the visual layout, but is fully visible to crawlers and screen readers.
 *
 * Also includes a <noscript> fallback for users with JS disabled.
 */

interface GameSeoContentProps {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  learningPoints?: string[];
}

export function GameSeoContent({
  title,
  description,
  category,
  tags,
  learningPoints,
}: GameSeoContentProps) {
  return (
    <>
      {/* Visually hidden but indexable by crawlers */}
      <div className="sr-only">
        <h2>{title}</h2>
        <p>{description}</p>
        {category && <p>Category: {category}</p>}
        {learningPoints && learningPoints.length > 0 && (
          <div>
            <h2>What You Will Learn</h2>
            <ul>
              {learningPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {tags && tags.length > 0 && (
          <p>Topics covered: {tags.join(', ')}</p>
        )}
      </div>

      {/* Fallback for users with JavaScript disabled */}
      <noscript>
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          <p className="text-lg mb-4">{description}</p>
          {learningPoints && learningPoints.length > 0 && (
            <>
              <h2 className="text-xl font-semibold mb-2">What You Will Learn</h2>
              <ul className="list-disc pl-6 mb-4">
                {learningPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </>
          )}
          <p className="text-muted-foreground">
            This interactive simulator requires JavaScript to run. Please enable JavaScript in your
            browser to use this tool.
          </p>
        </div>
      </noscript>
    </>
  );
}
