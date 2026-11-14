/** Link patterns that make a post show the affiliate disclosure banner. */
export const AFFILIATE_LINK_PATTERNS = [
  'm.do.co', // DigitalOcean referral
  'amzn.to', // Amazon short links
  'amazon.com/.*tag=', // Amazon affiliate tags
  '[?&]ref=devops-daily', // Partner referral links
  // Sponsors' own tracked short links. These carry no ref= param, so
  // without an entry here a post could lose its disclosure banner purely
  // by switching to the link the sponsor asked us to use.
  'link\\.svix\\.com',
  // Our own click tracker, which all sponsor placements link through.
  'go\\.devops-daily\\.com',
];

export function hasAffiliateLinks(content: string): boolean {
  return AFFILIATE_LINK_PATTERNS.some((pattern) => new RegExp(pattern).test(content));
}
