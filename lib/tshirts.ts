import data from './tshirts-data.json';

export interface TshirtDesign {
  slug: string;
  /** The full quote, may contain newlines for layout. */
  quote: string;
  /** Single-line display title derived from the quote. */
  title: string;
  style: 'terminal' | 'badge' | 'stacked' | 'statement';
  svg: string;
  png: string;
}

export const tshirtDesigns: TshirtDesign[] = (data as Array<{ slug: string; quote: string; style: string }>).map(
  (d) => ({
    slug: d.slug,
    quote: d.quote,
    title: d.quote.replace(/\n/g, ' '),
    style: d.style as TshirtDesign['style'],
    svg: `/tshirts/${d.slug}.svg`,
    png: `/tshirts/${d.slug}.png`,
  }),
);
