import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen,
  Sparkles,
  Code2,
  Cloud,
  Server,
  GitBranch,
  Container,
  Shield,
  Terminal,
  Rocket,
  Star,
  ExternalLink,
  Library,
  Wrench,
  Database,
  BookMarked,
  Award,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'DevOps Books | DevOps Daily',
  description:
    'Curated collection of the best DevOps, SRE, and Cloud Engineering books. From beginner guides to advanced practices.',
  openGraph: {
    title: 'DevOps Books | DevOps Daily',
    description:
      'Curated collection of the best DevOps, SRE, and Cloud Engineering books. From beginner guides to advanced practices.',
    type: 'website',
  },
};

interface Book {
  title: string;
  author: string;
  description: string;
  href: string;
  category: string;
  icon: React.ElementType;
  badges?: {
    text: string;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  }[];
  isAffiliate?: boolean;
  isClassic?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  publishYear?: string;
}

const categories = [
  { id: 'all', name: 'All Books', icon: Sparkles },
  { id: 'devops', name: 'DevOps & CI/CD', icon: GitBranch },
  { id: 'sre', name: 'SRE & Reliability', icon: Shield },
  { id: 'cloud', name: 'Cloud & Infrastructure', icon: Cloud },
  { id: 'containers', name: 'Containers & Kubernetes', icon: Container },
  { id: 'linux', name: 'Linux & Systems', icon: Terminal },
  { id: 'automation', name: 'Automation & IaC', icon: Wrench },
  { id: 'database', name: 'Databases', icon: Database },
];

const books: Book[] = [
  // DevOps & CI/CD
  {
    title: 'The Phoenix Project',
    author: 'Gene Kim, Kevin Behr, George Spafford',
    description:
      'A novel about IT, DevOps, and helping your business win. Follow an IT manager as he transforms a failing company.',
    href: 'https://amzn.to/4tnqnBZ',
    category: 'devops',
    icon: Rocket,
    publishYear: '2013',
    badges: [{ text: 'Must Read', variant: 'default' }],
    isClassic: true,
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'The DevOps Handbook',
    author: 'Gene Kim, Jez Humble, Patrick Debois, John Willis',
    description:
      'How to create world-class agility, reliability, and security in technology organizations.',
    href: 'https://amzn.to/4qsrDkl',
    category: 'devops',
    icon: BookOpen,
    publishYear: '2016',
    badges: [{ text: 'Comprehensive', variant: 'secondary' }],
    isClassic: true,
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'Continuous Delivery',
    author: 'Jez Humble, David Farley',
    description: 'Reliable software releases through build, test, and deployment automation.',
    href: 'https://amzn.to/4r65fPa',
    category: 'devops',
    icon: GitBranch,
    publishYear: '2010',
    badges: [{ text: 'Technical', variant: 'outline' }],
    isClassic: true,
    isAffiliate: true,
  },
  {
    title: 'Accelerate',
    author: 'Nicole Forsgren, Jez Humble, Gene Kim',
    description:
      'Building and scaling high performing technology organizations. Based on rigorous research.',
    href: 'https://amzn.to/4ci8YnX',
    category: 'devops',
    icon: Zap,
    publishYear: '2018',
    badges: [{ text: 'Research-Based', variant: 'secondary' }],
    isPopular: true,
    isAffiliate: true,
  },

  // SRE & Reliability
  {
    title: 'Site Reliability Engineering',
    author: 'Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Murphy',
    description:
      "How Google runs production systems. The definitive guide to SRE from Google's perspective.",
    href: 'https://sre.google/books/sre-book/',
    category: 'sre',
    icon: Shield,
    publishYear: '2016',
    badges: [{ text: 'Free Online', variant: 'default' }],
    isClassic: true,
    isPopular: true,
  },
  {
    title: 'The Site Reliability Workbook',
    author: 'Betsy Beyer, Niall Murphy, David Rensin, Kent Kawahara',
    description:
      'Practical ways to implement SRE. Real-world examples and case studies from Google and beyond.',
    href: 'https://sre.google/books/workbook/',
    category: 'sre',
    icon: Shield,
    publishYear: '2018',
    badges: [{ text: 'Free Online', variant: 'default' }],
    isPopular: true,
  },
  {
    title: 'Building Secure and Reliable Systems',
    author: 'Heather Adkins, Betsy Beyer, Paul Blankinship, Ana Oprea',
    description:
      'Best practices for designing, implementing, and maintaining systems with security and reliability in mind.',
    href: 'https://sre.google/books/building-secure-reliable-systems/',
    category: 'sre',
    icon: Shield,
    publishYear: '2020',
    badges: [
      { text: 'Free Online', variant: 'default' },
      { text: 'Security', variant: 'outline' },
    ],
  },

  // Cloud & Infrastructure
  {
    title: 'Cloud Native DevOps with Kubernetes',
    author: 'John Arundel, Justin Domingus',
    description:
      'Building, deploying, and scaling modern applications in the cloud with Kubernetes best practices.',
    href: 'https://amzn.to/4knzI8P',
    category: 'cloud',
    icon: Cloud,
    publishYear: '2019',
    badges: [{ text: 'Practical', variant: 'secondary' }],
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'AWS Certified Solutions Architect Study Guide',
    author: 'Ben Piper, David Clinton',
    description:
      'Comprehensive guide for AWS certification and architecting scalable systems on Amazon Web Services.',
    href: 'https://amzn.to/4aBCYKm',
    category: 'cloud',
    icon: Cloud,
    publishYear: '2020',
    badges: [{ text: 'Certification', variant: 'outline' }],
    isAffiliate: true,
  },

  // Containers & Kubernetes
  {
    title: 'Kubernetes in Action',
    author: 'Marko Lukša',
    description:
      'Learn Kubernetes from the ground up. Comprehensive guide covering core concepts to advanced patterns.',
    href: 'https://amzn.to/3OsD7XM',
    category: 'containers',
    icon: Container,
    publishYear: '2018',
    badges: [{ text: 'In-Depth', variant: 'secondary' }],
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'Docker Deep Dive',
    author: 'Nigel Poulton',
    description:
      'Zero to Docker in a single book. From basics to advanced features, production deployments.',
    href: 'https://amzn.to/4kq24iK',
    category: 'containers',
    icon: Container,
    publishYear: '2020',
    badges: [{ text: 'Beginner Friendly', variant: 'outline' }],
    isAffiliate: true,
  },
  {
    title: 'Kubernetes Up & Running',
    author: 'Brendan Burns, Joe Beda, Kelsey Hightower',
    description: 'Dive into the future of infrastructure. Learn from the creators of Kubernetes.',
    href: 'https://amzn.to/4a3rP4O',
    category: 'containers',
    icon: Container,
    publishYear: '2019',
    badges: [{ text: 'By K8s Creators', variant: 'default' }],
    isClassic: true,
    isAffiliate: true,
  },

  // Linux & Systems
  {
    title: 'The Linux Command Line',
    author: 'William Shotts',
    description:
      'A complete introduction to the Linux command line. Perfect for beginners and experienced users alike.',
    href: 'https://linuxcommand.org/tlcl.php',
    category: 'linux',
    icon: Terminal,
    publishYear: '2019',
    badges: [{ text: 'Free Online', variant: 'default' }],
    isPopular: true,
  },
  {
    title: 'Linux DevOps eBook Bundle',
    author: 'Bobby Iliev',
    description:
      'A comprehensive bundle covering Linux fundamentals to infrastructure management with Terraform. Perfect stepping stones into the vast world of technology.',
    href: 'https://leanpub.com/b/linux-devops-ebook-bundle',
    category: 'linux',
    icon: Library,
    publishYear: '2024',
    badges: [
      { text: 'Bundle', variant: 'default' },
      { text: 'Beginner Friendly', variant: 'outline' },
    ],
    isNew: true,
    isAffiliate: true,
  },
  {
    title: 'UNIX and Linux System Administration Handbook',
    author: 'Evi Nemeth, Garth Snyder, Trent Hein, Ben Whaley',
    description:
      'The definitive guide to Unix and Linux system administration. Comprehensive reference for sysadmins.',
    href: 'https://amzn.to/4r5aOgw',
    category: 'linux',
    icon: Server,
    publishYear: '2017',
    badges: [{ text: 'Reference', variant: 'outline' }],
    isClassic: true,
    isAffiliate: true,
  },
  {
    title: 'How Linux Works',
    author: 'Brian Ward',
    description: 'What every superuser should know. Deep dive into the inner workings of Linux.',
    href: 'https://amzn.to/45WlENw',
    category: 'linux',
    icon: Terminal,
    publishYear: '2021',
    badges: [{ text: 'Technical', variant: 'secondary' }],
    isAffiliate: true,
  },

  // Automation & IaC
  {
    title: 'Terraform: Up & Running',
    author: 'Yevgeniy Brikman',
    description:
      'Writing infrastructure as code. From basics to production-grade Terraform deployments.',
    href: 'https://amzn.to/4ttsR1K',
    category: 'automation',
    icon: Wrench,
    publishYear: '2022',
    badges: [{ text: 'Practical', variant: 'secondary' }],
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'Ansible for DevOps',
    author: 'Jeff Geerling',
    description:
      'Server and configuration management for humans. Learn Ansible from a practical perspective.',
    href: 'https://amzn.to/4tphxDK',
    category: 'automation',
    icon: Wrench,
    publishYear: '2020',
    badges: [{ text: 'Hands-On', variant: 'outline' }],
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'Infrastructure as Code',
    author: 'Kief Morris',
    description:
      'Managing servers in the cloud. Patterns and practices for dynamic infrastructure.',
    href: 'https://amzn.to/4bIrB4i',
    category: 'automation',
    icon: Code2,
    publishYear: '2020',
    badges: [{ text: 'Patterns', variant: 'secondary' }],
    isAffiliate: true,
  },

  // Databases
  {
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    description:
      'The big ideas behind reliable, scalable, and maintainable systems. Essential for backend engineers.',
    href: 'https://amzn.to/4tpxo50',
    category: 'database',
    icon: Database,
    publishYear: '2017',
    badges: [{ text: 'Must Read', variant: 'default' }],
    isClassic: true,
    isPopular: true,
    isAffiliate: true,
  },
  {
    title: 'Database Reliability Engineering',
    author: 'Laine Campbell, Charity Majors',
    description:
      'Designing and operating resilient database systems. Applying SRE principles to databases.',
    href: 'https://amzn.to/4r6u2m8',
    category: 'database',
    icon: Database,
    publishYear: '2017',
    badges: [{ text: 'SRE for DBs', variant: 'outline' }],
    isAffiliate: true,
  },
];

export default function BooksPage() {
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return books.length;
    return books.filter((book) => book.category === categoryId).length;
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Wow Effects */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10" />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
            style={{
              backgroundImage: `
                linear-gradient(90deg, currentColor 1px, transparent 1px),
                linear-gradient(currentColor 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />

          {/* Gradient orbs */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full filter blur-[100px] animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-[120px]" />
        </div>

        {/* Floating book icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="relative h-full mx-auto max-w-7xl">
            <BookOpen className="absolute w-8 h-8 top-20 left-10 text-blue-500/20 animate-float" />
            <BookMarked className="absolute w-8 h-8 top-1/3 right-10 lg:right-20 text-purple-500/15 animate-float animation-delay-2000" />
            <Library className="absolute w-8 h-8 bottom-1/3 left-10 lg:left-32 text-pink-500/10 animate-float animation-delay-4000" />
            <Award className="absolute w-8 h-8 bottom-20 right-10 lg:right-40 text-blue-500/15 animate-float animation-delay-3000" />
          </div>
        </div>

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="outline"
              className="mb-6 border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-1.5"
            >
              <Library className="mr-2 h-3.5 w-3.5" />
              Curated Book Collection
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="block mb-2 text-foreground">DevOps Books</span>
              <span className="block bg-clip-text text-transparent bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 animate-gradient leading-[1.2]">
                Level Up Your Skills
              </span>
            </h1>
            <p className="mb-8 text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Curated collection of the best DevOps, SRE, Cloud Engineering, and Infrastructure
              books. From beginner guides to advanced practices.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <Badge variant="secondary" className="text-xs px-3 py-1">
                <Star className="mr-1.5 h-3 w-3 fill-current" />
                Top Picks Only
              </Badge>
              <span className="text-muted-foreground/50">•</span>
              <Badge variant="secondary" className="text-xs px-3 py-1">
                <Sparkles className="mr-1.5 h-3 w-3" />
                {books.length} Essential Books
              </Badge>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-muted-foreground text-xs">
                Some links may be affiliate links
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Books Section */}
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="all" className="w-full">
            <div className="mb-8 sm:mb-10 lg:mb-12 overflow-x-auto pb-2">
              <TabsList className="h-14 inline-flex w-full min-w-max sm:w-auto flex-wrap justify-start sm:justify-center gap-2 bg-muted/50 p-2 rounded-xl">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <TabsTrigger
                      key={category.id}
                      value={category.id}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="hidden xs:inline">{category.name}</span>
                      <span className="xs:hidden">{category.name.split(' ')[0]}</span>
                      <Badge variant="outline" className="ml-1 text-xs h-5 px-1.5">
                        {getCategoryCount(category.id)}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((book, index) => (
                  <BookCard key={index} book={book} index={index} />
                ))}
              </div>
            </TabsContent>

            {categories
              .filter((cat) => cat.id !== 'all')
              .map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-0">
                  <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {books
                      .filter((book) => book.category === category.id)
                      .map((book, index) => (
                        <BookCard key={index} book={book} index={index} />
                      ))}
                  </div>
                </TabsContent>
              ))}
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="border-2 bg-linear-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-[0.02]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(90deg, currentColor 1px, transparent 1px),
                    linear-gradient(currentColor 1px, transparent 1px)
                  `,
                  backgroundSize: '30px 30px',
                }}
              />
            </div>

            <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 lg:p-16 text-center relative z-10">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
                <BookOpen className="relative h-12 w-12 sm:h-16 sm:w-16 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="mb-3 text-2xl sm:text-3xl lg:text-4xl font-bold">
                Know a Great Book?
              </h2>
              <p className="mb-8 max-w-md text-base sm:text-lg text-muted-foreground">
                Have a recommendation for a DevOps, SRE, or Cloud book that should be on this list?
                Let us know!
              </p>
              <Button size="lg" asChild className="shadow-lg hover:shadow-xl transition-all group">
                <a
                  href={`https://github.com/The-DevOps-Daily/devops-daily/issues/new?${new URLSearchParams(
                    {
                      title: 'Book Suggestion: [Book Title]',
                      body: `## Book Suggestion

**Book Title:**
<!-- Enter the full title of the book -->

**Author(s):**
<!-- Enter the author name(s) -->

**Category:**
<!-- Select one: DevOps & CI/CD, SRE & Reliability, Cloud & Infrastructure, Containers & Kubernetes, Linux & Systems, Automation & IaC, Databases -->

**Why should this book be included?**
<!-- Explain why you think this book deserves a spot in our curated collection -->

**Book URL:**
<!-- Link to where people can find this book (Amazon, publisher, etc.) -->

**Is it a classic/must-read?**
<!-- Yes/No and why -->

**Additional Information:**
<!-- Any other relevant details (free online, certification prep, beginner-friendly, etc.) -->
`,
                      labels: 'book-suggestion,content-request',
                    }
                  ).toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Suggest a Book
                  <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function BookCard({ book, index }: { book: Book; index: number }) {
  const Icon = book.icon;

  return (
    <Card
      className="group flex h-full flex-col transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 hover:-translate-y-1 bg-linear-to-br from-background to-muted/20"
      style={{
        animation: `fade-in 0.5s ease-out ${index * 0.05}s both`,
      }}
    >
      <CardHeader className="pb-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-purple-600 text-white shadow-lg group-hover:scale-110 transition-transform">
              <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end flex-1 min-w-0">
            {book.isPopular && (
              <Badge
                variant="default"
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm text-xs h-6"
              >
                <Star className="mr-1 h-3 w-3 fill-current" />
                Popular
              </Badge>
            )}
            {book.isNew && (
              <Badge
                variant="default"
                className="bg-green-600 hover:bg-green-700 shadow-sm text-xs h-6"
              >
                New
              </Badge>
            )}
            {book.isClassic && (
              <Badge
                variant="outline"
                className="border-purple-500 text-purple-600 dark:text-purple-400 shadow-sm text-xs h-6"
              >
                Classic
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="line-clamp-2 text-lg sm:text-xl group-hover:text-primary transition-colors leading-snug">
          {book.title}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-2">
          {book.author}
        </CardDescription>
        <CardDescription className="mt-2 sm:mt-3 line-clamp-3 text-sm leading-relaxed">
          {book.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="grow pb-4">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {book.badges?.map((badge, index) => (
            <Badge key={index} variant={badge.variant || 'secondary'} className="text-xs">
              {badge.text}
            </Badge>
          ))}
          {book.publishYear && (
            <Badge variant="outline" className="text-xs">
              {book.publishYear}
            </Badge>
          )}
          {book.isAffiliate && (
            <Badge
              variant="outline"
              className="border-blue-500 text-blue-600 dark:text-blue-400 text-xs"
            >
              Affiliate
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          asChild
          className="w-full group-hover:bg-primary group-hover:shadow-lg transition-all"
          size="sm"
        >
          <a href={book.href} target="_blank" rel="noopener noreferrer">
            View Book
            <ExternalLink className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
