import { Logo } from '@/components/ui/logo';
import { EasterEggTerminal } from '@/components/easter-egg-terminal';
import { BackgroundDecoration } from './footer/background-decoration';
import { SocialLink } from './footer/social-link';
import { FooterSection } from './footer/footer-section';
import { NewsletterForm } from './footer/newsletter-form';
import {
  socialLinks,
  contentSection,
  resourcesSection,
  topicsSection,
  legalSection,
} from './footer/footer-data';

export function Footer() {
  const categoriesSection = {
    title: 'Categories',
    links: [...resourcesSection.links, ...topicsSection.links],
  };

  return (
    <footer className="border-t border-border/50 relative overflow-hidden print:hidden bg-background">
      <BackgroundDecoration />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand + socials */}
          <div className="md:col-span-1 space-y-4">
            <Logo size={48} href="/" showText />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              The latest news, tutorials, and guides for DevOps professionals.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-mono text-muted-foreground">// follow</p>
              <div className="flex items-center gap-2 flex-wrap">
                {socialLinks.map((link) => (
                  <SocialLink key={link.href} link={link} />
                ))}
              </div>
            </div>
          </div>

          <FooterSection section={contentSection} label="content" />
          <FooterSection section={categoriesSection} label="categories" />

          <div className="space-y-4">
            <p className="text-xs font-mono text-muted-foreground">// subscribe</p>
            <NewsletterForm />
            <div className="pt-2">
              <FooterSection section={legalSection} label="legal" />
            </div>
          </div>
        </div>

        {/* Footer bottom — terminal-style bar */}
        <div className="mt-12 pt-6 border-t border-border/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
            <p className="tabular-nums">
              <span className="text-green-500/70">$</span> echo &quot;
              <span className="text-foreground">
                &copy; {new Date().getFullYear()} DevOps Daily
              </span>
              &quot;
            </p>
            <EasterEggTerminal variant="text" />
            <p>
              <span className="text-green-500/70">$</span> uptime{' '}
              <span className="text-muted-foreground/70">#</span>{' '}
              <span className="text-foreground">built for DevOps engineers</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
