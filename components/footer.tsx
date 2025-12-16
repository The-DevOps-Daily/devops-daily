import Link from 'next/link';
import { Rss, X, Linkedin, Github, Mail, ArrowRight, Sparkles, Instagram } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { EasterEggTerminal } from '@/components/easter-egg-terminal';

export function Footer() {
  return (
    <footer className="bg-linear-to-br from-background via-background to-muted/20 border-t border-border/50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-primary/5 to-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-blue-500/5 to-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1 space-y-6">
            <div>
              <Logo size={60} href="/" showText interactive />
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
                <Link
                  href="/feed.xml"
                  className="group p-3 bg-linear-to-br from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 border border-orange-500/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110"
                  target="_blank"
                >
                  <Rss className="h-5 w-5 text-orange-500 group-hover:text-orange-400" />
                  <span className="sr-only">RSS Feed</span>
                </Link>
                <Link
                  href="https://x.com/thedevopsdaily"
                  className="group p-3 bg-linear-to-br from-slate-500/10 to-slate-600/10 hover:from-slate-500/20 hover:to-slate-600/20 border border-slate-500/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110"
                  target="_blank"
                >
                  <X className="h-5 w-5 text-slate-500 group-hover:text-slate-400" />
                  <span className="sr-only">X</span>
                </Link>
                <Link
                  href="https://www.linkedin.com/company/thedevopsdaily"
                  className="group p-3 bg-linear-to-br from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 border border-blue-500/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110"
                  target="_blank"
                >
                  <Linkedin className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
                  <span className="sr-only">LinkedIn</span>
                </Link>
                <Link
                  href="https://github.com/The-DevOps-Daily"
                  className="group p-3 bg-linear-to-br from-gray-500/10 to-gray-600/10 hover:from-gray-500/20 hover:to-gray-600/20 border border-gray-500/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110"
                  target="_blank"
                >
                  <Github className="h-5 w-5 text-gray-500 group-hover:text-gray-400" />
                  <span className="sr-only">GitHub</span>
                </Link>
                <Link
                  href="https://www.instagram.com/thedailydevops"
                  className="group p-3 bg-linear-to-br from-pink-500/10 to-pink-600/10 hover:from-pink-500/20 hover:to-pink-600/20 border border-pink-500/20 rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110"
                  target="_blank"
                >
                  <Instagram className="h-5 w-5 text-pink-500 group-hover:text-pink-400" />
                  <span className="sr-only">Instagram</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Content
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/posts"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">All Posts</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/guides"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Guides</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Categories</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/sitemap.xml"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Sitemap</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/roadmap"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Roadmap</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/toolbox"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Toolbox</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/games"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Games</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/quizzes"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Quizzes</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/books/devops-survival-guide"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">DevOps Survival Guide</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Categories
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/categories/kubernetes"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Kubernetes</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/categories/terraform"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Terraform</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/categories/docker"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Docker</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/categories/ci-cd"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">CI/CD</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/categories/cloud"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Cloud</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Newsletter & Legal
            </h3>

            {/* Newsletter Signup */}
            <div className="p-6 bg-linear-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-2xl shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-foreground">Stay Updated</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Get the latest DevOps insights delivered to your inbox weekly.
              </p>
              <form
                action="https://devops-daily.us2.list-manage.com/subscribe/post?u=d1128776b290ad8d08c02094f&amp;id=fd76a4e93f&amp;f_id=0022c6e1f0"
                method="post"
                target="_blank"
                noValidate
                className="space-y-3"
              >
                <input
                  type="email"
                  name="EMAIL"
                  id="mce-EMAIL"
                  required
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-border/50 bg-background/50 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300"
                />

                {/* Honeypot bot field */}
                <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                  <input
                    type="text"
                    name="b_d1128776b290ad8d08c02094f_fd76a4e93f"
                    tabIndex={-1}
                    defaultValue=""
                  />
                </div>

                <button
                  type="submit"
                  name="subscribe"
                  className="group inline-flex items-center justify-center w-full px-4 py-3 bg-linear-to-r from-primary to-purple-600 text-white rounded-xl text-sm font-bold hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  Subscribe Now
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </form>
            </div>

            {/* Legal Links */}
            <ul className="space-y-3">
              <li>
                <Link
                  href="/privacy"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Privacy Policy</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Terms of Service</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link
                  href="/sponsorship"
                  className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
                >
                  <span className="font-medium">Sponsorship</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

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
