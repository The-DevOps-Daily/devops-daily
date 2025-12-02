import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingUp, Award, CheckCircle, Mail, Sparkles, BarChart } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sponsorship',
  description:
    'Partner with DevOps Daily to reach thousands of DevOps professionals and decision-makers',
};

export default function SponsorshipPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background py-20">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/10 via-background to-background" />
          <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-1.5 border-blue-500/50 bg-blue-500/5">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              Limited Sponsorship Spots Available
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Reach{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600">
                10,000+
              </span>{' '}
              DevOps Professionals
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              Partner with DevOps Daily to connect with a highly engaged audience of DevOps
              engineers, SREs, and technical decision-makers
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="shadow-lg shadow-blue-500/20">
                <a href="mailto:info@devops-daily.com?subject=Sponsorship Inquiry">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Us
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#packages">View Packages</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">10k+</div>
              <div className="text-muted-foreground">Monthly Readers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">85%</div>
              <div className="text-muted-foreground">Senior Engineers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">65%</div>
              <div className="text-muted-foreground">Decision Makers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">92%</div>
              <div className="text-muted-foreground">Engagement Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Sponsor Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Why Sponsor DevOps Daily?
            </h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Connect with the professionals shaping the future of DevOps
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Target className="h-6 w-6" />
                    </div>
                    <CardTitle>Targeted Audience</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Reach DevOps engineers, SREs, cloud architects, and technical leadership
                    actively seeking tools and solutions
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <CardTitle>Growing Community</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Our readership grows 30% month-over-month, with highly engaged professionals
                    from Fortune 500 companies
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                      <Award className="h-6 w-6" />
                    </div>
                    <CardTitle>Premium Content</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your brand alongside expert-written tutorials, guides, and industry insights
                    that developers trust
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                      <BarChart className="h-6 w-6" />
                    </div>
                    <CardTitle>Authentic Exposure</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Get your message in front of a focused audience without the noise or
                    distractions of traditional ads.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsorship Packages */}
      <section id="packages" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Sponsorship Packages
            </h2>
            <p className="text-xl text-center text-muted-foreground mb-12">
              Choose the package that best fits your goals
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter Package */}
              <Card className="relative overflow-hidden border-2 hover:border-blue-500/50 transition-all">
                <CardHeader>
                  <CardTitle className="text-2xl">Starter</CardTitle>
                  <CardDescription>Perfect for emerging companies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">$500</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-3">
                    {[
                      'Logo on all article pages',
                      'Monthly newsletter mention',
                      'Social media shoutout',
                    ].map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Professional Package */}
              <Card className="relative overflow-hidden border-2 border-blue-500 shadow-lg shadow-blue-500/10">
                <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm rounded-bl-lg">
                  Popular
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Professional</CardTitle>
                  <CardDescription>Our most popular option</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">$1,500</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-3">
                    {['Everything in Starter', 'Homepage placement', 'Dedicated blog post'].map(
                      (feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      )
                    )}
                  </ul>
                </CardContent>
              </Card>

              {/* Enterprise Package */}
              <Card className="relative overflow-hidden border-2 hover:border-purple-500/50 transition-all">
                <CardHeader>
                  <CardTitle className="text-2xl">Enterprise</CardTitle>
                  <CardDescription>Maximum visibility & impact</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-3xl font-bold">Custom</span>
                  </div>
                  <ul className="space-y-3">
                    {[
                      'Everything in Professional',
                      'Exclusive partnerships',
                      'Custom content series',
                    ].map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 via-background to-background" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Reach Your Target Audience?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join industry leaders who trust DevOps Daily to connect with the DevOps community
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="shadow-lg shadow-blue-500/20">
                <a href="mailto:info@devops-daily.com?subject=Sponsorship Inquiry">
                  <Mail className="mr-2 h-4 w-4" />
                  Email: info@devops-daily.com
                </a>
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              We typically respond within 24 hours
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
