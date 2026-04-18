import { Mail, ArrowRight } from 'lucide-react';

export function NewsletterForm() {
  return (
    <div className="p-6 bg-primary/5 border border-primary/20 rounded-md">
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
          className="w-full px-4 py-3 border border-border/50 bg-background/50 backdrop-blur-sm rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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
          className="group inline-flex items-center justify-center w-full px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Subscribe
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </form>
    </div>
  );
}
