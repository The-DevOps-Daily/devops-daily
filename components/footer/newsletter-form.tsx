import { Mail, ArrowRight } from 'lucide-react';
import { BREVO_FORM_URL } from '@/lib/newsletter';

export function NewsletterForm() {
  return (
    <div className="p-6 bg-linear-to-br from-primary/5 to-purple-500/5 border border-primary/20 rounded-2xl shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-primary" />
        <h4 className="font-bold text-foreground">Stay Updated</h4>
      </div>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Get the latest DevOps insights delivered to your inbox weekly.
      </p>
      <form
        action={BREVO_FORM_URL}
        method="post"
        target="_blank"
        noValidate
        className="space-y-3"
      >
        <input
          type="email"
          name="EMAIL"
          required
          placeholder="your@email.com"
          className="w-full px-4 py-3 border border-border/50 bg-background/50 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300"
        />

        {/* Brevo bot-protection fields */}
        <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
          <input type="text" name="email_address_check" defaultValue="" tabIndex={-1} />
          <input type="hidden" name="locale" value="en" />
        </div>

        <button
          type="submit"
          className="group inline-flex items-center justify-center w-full px-4 py-3 bg-linear-to-r from-primary to-purple-600 text-white rounded-xl text-sm font-bold hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
        >
          Subscribe Now
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
        </button>
      </form>
    </div>
  );
}
