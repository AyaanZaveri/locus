import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, Asterisk, BookOpen, Flag, TrendingUp, UserRound } from "lucide-react"

const keyPeople = [
  {
    name: "Han Wang",
    role: "Co-Founder & CEO",
    image: "/han-wang.jpg",
    linkedin: "https://www.linkedin.com/in/handotdev/?utm_source=chatgpt.com",
    x: "https://x.com/handotdev?utm_source=chatgpt.com",
  },
  {
    name: "Hahnbee Lee",
    role: "Co-Founder",
    image: "/hahnbee-lee.jpg",
    linkedin: "https://www.linkedin.com/in/hahnbee-lee/?utm_source=chatgpt.com",
    x: "https://x.com/hahnbeelee?utm_source=chatgpt.com",
  },
  {
    name: "Dean Sliney",
    role: "Head of Support Engineering",
    image: "/dean-sliney.jpg",
    linkedin: "https://www.linkedin.com/in/dean-sliney/?utm_source=chatgpt.com",
  },
  {
    name: "Justin Torre",
    role: "Head of Enterprise Solutions",
    image: "/justin-torre.jpg",
    linkedin: "https://www.linkedin.com/in/justintorre/?utm_source=chatgpt.com",
    x: "https://x.com/justintorre?utm_source=chatgpt.com",
  },
  {
    name: "Ruairi Wiepking",
    role: "Head of Sales",
    image: "/ruairi-wiepking.jpg",
    linkedin: "https://www.linkedin.com/in/ruairiwiepking/?utm_source=chatgpt.com",
  },
]

const activityTone = {
  funding: "bg-emerald-500/5 text-emerald-600/75",
  hiring: "bg-teal-500/5 text-teal-600/75",
  people: "bg-violet-500/5 text-violet-600/75",
  product: "bg-orange-500/5 text-orange-600/75",
  documentation: "bg-slate-500/5 text-slate-600/75",
  news: "bg-slate-500/5 text-slate-600/75",
} as const

const activity = [
  { icon: Flag, tone: "product", time: "Sep 15, 2026", dateTime: "2026-09-15", title: "Released Automations, rebuilt", description: "Mintlify redesigned Automations with pre-built workflows optimized for common documentation use cases." },
  { icon: Flag, tone: "product", time: "Sep 8, 2026", dateTime: "2026-09-08", title: "Introduced outcome-based AI pricing", description: "Mintlify changed AI actions to a credit-based model where users pay based on delivered results." },
  { icon: BookOpen, tone: "documentation", time: "Sep 1, 2026", dateTime: "2026-09-01", title: "Improved llms.txt generation for large docs sites", description: "Mintlify rebuilt llms.txt generation using hierarchical files so AI agents can access larger documentation sets without loading everything at once." },
  { icon: TrendingUp, tone: "funding", time: "Apr 14, 2026", dateTime: "2026-04-14", title: "Raised $45M Series B", description: "Mintlify raised a Series B led by Andreessen Horowitz and Salesforce Ventures, bringing total funding to $67M." },
  { icon: BookOpen, tone: "documentation", time: "Aug 6, 2026", dateTime: "2026-08-06", title: "Launched Mintlify Index", description: "Mintlify introduced an index of thousands of Mintlify-powered documentation sites designed for natural-language retrieval by coding agents." },
] as const

export default function Page() {
  return (
    <main id="top" className="p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
      <div className="relative max-w-8xl">
        <div className="relative h-72 overflow-hidden rounded-lg shadow-xs">
          <img alt="Mintlify banner" draggable={false} className="h-[calc(100%+10px)] w-full -translate-y-2.5 object-cover object-top" src="/mintlify-banner.webp" />
          <ProgressiveBlur className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5" blurIntensity={0.5} />
        </div>
        <div className="absolute -bottom-8 left-4 rounded-xl ring-1 ring-border/50 bg-background/75 backdrop-blur-sm p-1 shadow-xs sm:-bottom-6 sm:left-5">
          <img alt="Mintlify logo" draggable={false} className="size-16 rounded-lg sm:size-20 ring-1 ring-border/25" src="/mintlify-logo.webp" />
        </div>
      </div>
      <h1 className="mt-12 text-2xl font-semibold tracking-tight">Mintlify</h1>
      <p className="text-sm font-medium text-muted-foreground">Knowledge infrastructure for AI</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">Software Development</Badge>
        <Badge variant="secondary">
          <img
            alt=""
            aria-hidden="true"
            className="size-3 rounded-full mr-0.5"
            src="https://hatscripts.github.io/circle-flags/flags/us.svg"
          />
          San Francisco, California
        </Badge>
        <Badge variant="secondary">
          <Asterisk aria-hidden="true" />
          Series B
        </Badge>
        <Badge variant="secondary">
          <UserRound aria-hidden="true" />
          201-500 employees
        </Badge>
      </div>
      <section className="mt-6 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">About</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Mintlify powers docs for 20,000+ companies, reaching 100M+ developers a year. When humans or agents need to understand your product, they start with your docs. We make sure they find the right answers. We&apos;re hiring in SF at mintlify.com/careers.
        </p>
      </section>
      <section className="mt-6 max-w-3xl">
        <h2 className="text-lg font-semibold tracking-tight">Key people</h2>
        <div className="mt-4 grid gap-3 grid-cols-2">
          {keyPeople.map((person) => (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3" key={person.name}>
              <Avatar className="size-10">
                <AvatarImage alt={person.name} src={person.image} />
                <AvatarFallback>{person.name.split(" ").map((part) => part[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{person.name}</p>
                <p className="truncate text-xs text-muted-foreground font-medium">{person.role}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button
                  aria-label={`${person.name} on LinkedIn`}
                  render={
                    <a href={person.linkedin} rel="noreferrer" target="_blank" />
                  }
                  size="icon-sm"
                  variant="ghost"
                >
                  <span
                    aria-hidden="true"
                    className="block size-3.5 shrink-0 bg-muted-foreground"
                    style={{
                      mask: "url('/icons/linkedin.svg') center / contain no-repeat",
                      WebkitMask: "url('/icons/linkedin.svg') center / contain no-repeat",
                    }}
                  />
                </Button>
                {person.x ? (
                  <Button
                    aria-label={`${person.name} on X`}
                    render={
                      <a href={person.x} rel="noreferrer" target="_blank" />
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <span
                      aria-hidden="true"
                      className="block size-3.5 shrink-0 bg-muted-foreground"
                      style={{
                        mask: "url('/icons/x.svg') center / contain no-repeat",
                        WebkitMask: "url('/icons/x.svg') center / contain no-repeat",
                      }}
                    />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
        </div>
        <aside className="h-fit pt-2 xl:sticky xl:top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
            <Button className="-translate-y-px" variant="ghost">
              View all
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <ol className="mt-3 flex flex-col gap-3">
            {activity.map((item, index) => {
              const Icon = item.icon
              return (
                <li
                  className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
                  key={item.title}
                >
                  {index < activity.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-[42px] bottom-[-0.625rem] left-4 w-[1.5px] -translate-x-1/2 rounded-full bg-border"
                    />
                  ) : null}
                  <div className={cn("relative z-10 mt-1 flex size-8 items-center justify-center rounded-lg ring-4 ring-background", activityTone[item.tone])}>
                    <Icon className="size-3.5" aria-hidden="true" />
                  </div>
                  <article className="min-w-0 rounded-lg bg-muted/40 px-3 pb-2.5 pt-1.5">
                    <time className="text-xs font-medium text-muted-foreground" dateTime={item.dateTime}>{item.time}</time>
                    <h3 className="mt-0.5 text-[13px] font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </article>
                </li>
              )
            })}
          </ol>
        </aside>
      </div>
    </main>
  )
}
