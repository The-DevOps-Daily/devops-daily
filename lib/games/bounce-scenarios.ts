/**
 * Real-world SMTP bounce scenarios for the bounce triage simulator.
 *
 * Codes and diagnostic strings follow RFC 3463 enhanced status codes and the
 * wording major providers actually send. The teaching point of the whole game
 * is that the SMTP class digit (4 vs 5) is a hint, not the answer: plenty of
 * 5xx responses are really "slow down" and a couple of 4xx ones will never
 * succeed no matter how long you retry.
 */

export type BounceKind = 'hard' | 'soft' | 'block' | 'complaint';
export type BounceAction = 'suppress' | 'retry' | 'fix-content' | 'slow-down';

export interface BounceScenario {
  id: string;
  /** What the receiving server actually said. */
  response: string;
  /** Who it was addressed to, for flavour and the occasional typo clue. */
  recipient: string;
  /** Where the bounce came from, since providers differ in wording. */
  provider: string;
  kind: BounceKind;
  action: BounceAction;
  /** Shown after answering: what the code means. */
  explanation: string;
  /** Shown after answering: what it costs you to get this one wrong. */
  consequence: string;
}

export const KIND_LABELS: Record<BounceKind, string> = {
  hard: 'Hard bounce',
  soft: 'Soft bounce',
  block: 'Blocked',
  complaint: 'Complaint',
};

export const KIND_HINTS: Record<BounceKind, string> = {
  hard: 'Permanent. This address will never accept mail.',
  soft: 'Temporary. The same address may well accept it later.',
  block: 'The address is fine. They are refusing you, this message, or this rate.',
  complaint: 'The recipient marked it as spam.',
};

export const ACTION_LABELS: Record<BounceAction, string> = {
  suppress: 'Suppress permanently',
  retry: 'Retry with backoff',
  'fix-content': 'Fix the message, then retry',
  'slow-down': 'Slow down, then retry',
};

export const BOUNCE_SCENARIOS: BounceScenario[] = [
  {
    id: 'user-unknown',
    response: '550 5.1.1 <jhon@exmaple.com>: Recipient address rejected: User unknown in virtual mailbox table',
    recipient: 'jhon@exmaple.com',
    provider: 'Postfix',
    kind: 'hard',
    action: 'suppress',
    explanation:
      '5.1.1 is the canonical "no such mailbox" response. Note the address itself: jhon at exmaple.com is a double typo of john at example.com, which is what most hard bounces really are. Someone mistyped their address at signup.',
    consequence:
      'Retrying this costs you reputation every single time. A rising hard bounce rate is the fastest way to get throttled, and mailbox providers read repeated sends to a known-dead address as a sign you are mailing a purchased list.',
  },
  {
    id: 'mailbox-full',
    response: '452 4.2.2 The email account that you tried to reach is over quota',
    recipient: 'sarah@company.com',
    provider: 'Gmail',
    kind: 'soft',
    action: 'retry',
    explanation:
      '4.2.2 means the mailbox exists and the person is real, they have simply run out of space. This is the textbook soft bounce.',
    consequence:
      'Suppressing on this is the expensive mistake. You permanently lose a real subscriber because they were briefly over quota. Retry with backoff, and only give up after it has failed consistently for days.',
  },
  {
    id: 'greylisted',
    response: '450 4.7.1 <mail@yourdomain.com>: Recipient address rejected: Greylisted, try again in 300 seconds',
    recipient: 'ops@smallbusiness.co.uk',
    provider: 'Postgrey',
    kind: 'soft',
    action: 'retry',
    explanation:
      'Greylisting deliberately rejects the first attempt from an unknown sender, on the theory that spam software does not retry and real mail servers do. Wait the stated interval and the retry is usually accepted.',
    consequence:
      'Treating greylisting as a failure means you never deliver to a whole class of small self-hosted domains. The retry is the entire point of the mechanism: it is a test you pass by behaving like a real mail server.',
  },
  {
    id: 'spam-content',
    response: '550 5.7.1 Message rejected due to content restrictions',
    recipient: 'team@enterprise.com',
    provider: 'Proofpoint',
    kind: 'block',
    action: 'fix-content',
    explanation:
      'A 5xx that is not about the address at all. The mailbox is fine and the recipient is real; a content filter objected to something in the message. Common causes are a link shortener, a bare IP in a URL, an attachment type, or copy that reads like phishing.',
    consequence:
      'Suppressing here throws away a valid recipient for a problem that lives in your template. Fix the message and it delivers. The trap is that the 5 in 550 looks permanent, so naive triage files it with the dead addresses.',
  },
  {
    id: 'gmail-unauthenticated',
    response: '550-5.7.26 Unauthenticated email from yourdomain.com is not accepted due to domain\'s DMARC policy.',
    recipient: 'user@gmail.com',
    provider: 'Gmail',
    kind: 'block',
    action: 'fix-content',
    explanation:
      'Nothing to do with the recipient. Your DMARC policy told Gmail to reject mail that fails authentication, and this message failed. Usually SPF or DKIM alignment: the From domain does not match the domain that actually authenticated.',
    consequence:
      'Suppressing recipients over this hides an authentication bug behind a shrinking list. Every message you send is failing the same way. Fix the DNS or the signing domain and the whole class disappears.',
  },
  {
    id: 'rate-limited',
    response: '421 4.7.0 Too many messages from your IP. Please try again later.',
    recipient: 'contact@bigcorp.com',
    provider: 'Outlook',
    kind: 'block',
    action: 'slow-down',
    explanation:
      'A 421 closes the connection. The provider is telling you the rate is the problem, not the mail. Common when a new sending domain sends a burst instead of ramping up.',
    consequence:
      'Retrying immediately at the same rate makes it worse and can get the IP temporarily blocked. Reduce concurrency, spread the send, and let the reputation build.',
  },
  {
    id: 'domain-not-found',
    response: '550 5.1.2 Domain not found. The domain in the recipient address does not exist.',
    recipient: 'contact@companythatfolded.io',
    provider: 'Generic MTA',
    kind: 'hard',
    action: 'suppress',
    explanation:
      '5.1.2 means the domain has no MX or A record. The company shut down, the domain lapsed, or it was never real. There is no server to accept this mail.',
    consequence:
      'This one never recovers, so retrying is pure waste. Worth checking the whole list: if many addresses share a dead domain, one company folding can quietly rot a chunk of your audience.',
  },
  {
    id: 'complaint-feedback-loop',
    response: 'Feedback-Type: abuse\nUser-Agent: Yahoo!-Mail-Feedback/2.0\nOriginal-Rcpt-To: reader@yahoo.com',
    recipient: 'reader@yahoo.com',
    provider: 'Yahoo (ARF feedback loop)',
    kind: 'complaint',
    action: 'suppress',
    explanation:
      'Not a bounce at all. This is an ARF report from a feedback loop: the message was delivered, and the recipient pressed "report spam". You only see these if you are enrolled in the provider feedback loops.',
    consequence:
      'Suppress immediately and permanently. Someone who reported you as spam is never a re-engagement opportunity, and complaints are weighted far more heavily than bounces. Google starts throttling around 0.3%, which is three people per thousand.',
  },
  {
    id: 'relay-denied',
    response: '554 5.7.1 <recipient@partner.com>: Relay access denied',
    recipient: 'recipient@partner.com',
    provider: 'Postfix',
    kind: 'block',
    action: 'fix-content',
    explanation:
      'The receiving server does not consider itself responsible for that domain, so it refuses to relay. Usually a stale MX record pointing at a server that no longer hosts the domain, or a misrouted internal address.',
    consequence:
      'Not the recipient\'s fault and not fixable by retrying. It needs a DNS or routing fix on their side, so this is a support conversation rather than a list-hygiene action.',
  },
  {
    id: 'temporary-server-failure',
    response: '451 4.3.0 Temporary server error. Please try again later. (SRV-1)',
    recipient: 'hello@startup.dev',
    provider: 'Outlook',
    kind: 'soft',
    action: 'retry',
    explanation:
      '4.3.0 is the receiving server admitting its own problem. Nothing is wrong with the address, your content, or your reputation.',
    consequence:
      'Retry with backoff and it almost always delivers. The only mistake here is giving up too early, or hammering it with immediate retries and turning a transient error into a rate-limit block.',
  },
  {
    id: 'blocked-listing',
    response: '554 5.7.1 Service unavailable; Client host [203.0.113.42] blocked using Spamhaus SBL',
    recipient: 'anyone@anywhere.com',
    provider: 'Generic MTA',
    kind: 'block',
    action: 'slow-down',
    explanation:
      'Your sending IP is on a public blocklist. Nothing about this recipient is wrong, and it will affect everything you send until it is resolved.',
    consequence:
      'The urgent signal in the list: stop sending, find what caused the listing (usually a spike in complaints or hitting a spam trap), fix it, then request delisting. Continuing to send while listed deepens the hole.',
  },
  {
    id: 'disabled-mailbox',
    response: '550 5.2.1 The email account that you tried to reach is disabled.',
    recipient: 'former.employee@company.com',
    provider: 'Gmail',
    kind: 'hard',
    action: 'suppress',
    explanation:
      '5.2.1 means the mailbox exists but has been switched off, which is what happens to a work address after someone leaves. It will not come back.',
    consequence:
      'Suppress it. This is also worth surfacing to the customer, since a B2B list quietly fills with departed employees and the bounce rate creeps up until it starts costing deliverability.',
  },
];
