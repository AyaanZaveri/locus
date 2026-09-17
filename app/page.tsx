import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Asterisk, UserRound } from "lucide-react"

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

export default function Page() {
  return (
    <main id="top" className="p-6">
      <div className="relative max-w-8xl">
        <div className="relative overflow-hidden rounded-lg shadow-xs">
          <img alt="Mintlify banner" draggable={false} className="size-full object-cover object-top h-72" src="/mintlify-banner.webp" />
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
      <section className="mt-8 max-w-3xl">
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
    </main>
  )
}
