import { Logo } from '@/components/ui/logo';
import { EasterEggTerminal } from '@/components/easter-egg-terminal';
import { BackgroundDecoration } from './footer/background-decoration';
import { SocialLink } from './footer/social-link';
import { FooterSection } from './footer/footer-section';
import { NewsletterForm } from './footer/newsletter-form';
import { Sparkles } from 'lucide-react';
import {
  socialLinks,
  contentSection,
  resourcesSection,
  topicsSection,
  legalSection,
} from './footer/footer-data';

export function Footer() {
  return (
    <footer className="bg-linear-to-br from-background via-background to-muted/20 border-t border-border/50 relative overflow-hidden print:hidden">
      <BackgroundDecoration />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo and Social Links */}
          <div className="md:col-span-1 space-y-6">
            <div>
              <Logo size={60} href="/" showText />
              <p className="mt-4 text-base text-muted-foreground leading-relaxed font-medium">
                The latest news, tutorials, and guides for DevOps professionals.
                <span className="block mt-2 text-primary/80 font-semibold">
                  Join thousands learning DevOps!
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                Follow Us
              </h4>
              <div className="flex items-center gap-3 flex-wrap">
                {socialLinks.map((link) => (
                  <SocialLink key={link.href} link={link} />
                ))}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <FooterSection section={contentSection} />

          {/* Categories Section (combined resources and topics) */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Categories
            </h3>
            <ul className="space-y-3">
              {[...resourcesSection.links, ...topicsSection.links].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                  >
                    <span className="font-medium">{link.label}</span>
                    <svg
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter & Legal */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Newsletter & Legal
            </h3>

            <NewsletterForm />

            {/* Legal Links */}
            <FooterSection section={legalSection} />
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-16 pt-8 border-t border-border/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground font-medium">
              &copy; {new Date().getFullYear()} DevOps Daily. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <EasterEggTerminal variant="text" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Made with</span>
              <span className="text-red-500 animate-pulse">❤️</span>
              <span>for the DevOps community</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
