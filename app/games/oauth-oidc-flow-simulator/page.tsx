import type { Metadata } from 'next';
import OAuthOidcFlowSimulator from '@/components/games/oauth-oidc-flow-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('oauth-oidc-flow-simulator');
}

function OAuthOidcEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this OAuth/OIDC simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How authorization code + PKCE moves through browser and back-channel requests</li>
            <li>Why state, nonce, redirect URI matching, and PKCE are separate protections</li>
            <li>The difference between ID tokens, access tokens, and refresh tokens</li>
            <li>How APIs validate audience, issuer, expiry, and scope</li>
            <li>Why refresh token rotation matters</li>
            <li>How common OAuth mistakes show up in real debugging sessions</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Flows covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Login:</strong> authorize URL, redirect, login,
              consent, callback
            </li>
            <li>
              <strong className="text-foreground">Tokens:</strong> code exchange, ID token
              validation, UserInfo/API calls
            </li>
            <li>
              <strong className="text-foreground">Sessions:</strong> secure app session cookies
              and token storage boundaries
            </li>
            <li>
              <strong className="text-foreground">Failure modes:</strong> bad redirect URIs, broad
              scopes, expired access tokens
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">OAuth vs OIDC</h4>
        <p className="text-sm text-muted-foreground">
          OAuth delegates API access. OpenID Connect layers identity on top of OAuth by adding the
          <strong className="text-foreground"> openid</strong> scope, ID tokens, and standardized
          user identity claims.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not contact a real identity provider. It models the messages and
          validation decisions in the browser so you can reason about the flow before wiring a real
          provider like Auth0, Okta, Entra ID, Cognito, Keycloak, or Clerk.
        </p>
      </div>
    </>
  );
}

export default function OAuthOidcFlowSimulatorPage() {
  return (
    <SimulatorShell
      slug="oauth-oidc-flow-simulator"
      fallbackTitle="OAuth/OIDC Flow Simulator"
      fallbackDescription="Visualize OAuth 2.0 and OpenID Connect flows in an interactive browser simulator. Learn authorization code + PKCE, tokens, scopes, refresh, callbacks, and common auth errors."
      educational={<OAuthOidcEducational />}
      shareText="Learn OAuth and OpenID Connect with this interactive flow simulator."
    >
      <OAuthOidcFlowSimulator />
    </SimulatorShell>
  );
}
