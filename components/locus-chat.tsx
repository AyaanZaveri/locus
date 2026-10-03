"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDown,
  ArrowUpIcon,
  LensConcaveIcon,
  PlusIcon,
  SquareIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { LocusModelPicker } from "@/components/locus-model-picker";
import { useLocusModel } from "@/lib/use-locus-model";
import { isLocusFocusClickZone } from "@/lib/locus-focus-click-zone";
import { LocusResponseTimer } from "@/lib/locus-response-timer";
import { LocusActivityStatus } from "@/components/locus-activity-status";
import { LocusTraceRow } from "@/components/locus-trace-row";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  LocusResultRows,
  type LocusCompanyResult,
  type LocusJobResult,
  type LocusPersonResult,
  type LocusSearchResults,
} from "@/components/locus-result-rows";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { jobDetailsHref } from "@/lib/job-navigation";
import { personDetailsHref } from "@/lib/person-navigation";
import { describeLocusTool, type LocusTrace } from "@/lib/locus-tool-trace";
import {
  getLocusActivityLabel,
  LOCUS_ACTIVITY_VARIANT_COUNT,
} from "@/lib/locus-activity-label";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNullableString(value: unknown) {
  return value === null || typeof value === "string" ? value : null;
}

type LocusNavigation =
  | {
      companySlug: string;
      destination: "company";
    }
  | {
      companySlug: string;
      destination: "person";
      personName: string;
      personUrl: string | null;
    }
  | {
      companySlug: string;
      destination: "job";
      jobTitle: string;
      jobLocation: string;
    };

function asLocusNavigation(value: unknown): LocusNavigation | null {
  if (!isRecord(value)) return null;

  const companySlug = asString(value.companySlug);
  const destination = asString(value.destination);
  if (!companySlug || !/^[a-z0-9-]+$/.test(companySlug)) {
    return null;
  }

  if (destination === "job") {
    const jobTitle = asString(value.jobTitle);
    const jobLocation = asString(value.jobLocation);
    if (!jobTitle || !jobLocation) return null;

    return { companySlug, destination, jobTitle, jobLocation };
  }

  if (destination === "person") {
    const personName = asString(value.personName);
    if (!personName) return null;

    return {
      companySlug,
      destination,
      personName,
      personUrl: asNullableString(value.personUrl),
    };
  }

  if (destination === "company") {
    return { companySlug, destination };
  }

  return null;
}

function asCompanyResult(value: unknown): LocusCompanyResult | null {
  if (!isRecord(value)) return null;
  const slug = asString(value.slug);
  const name = asString(value.name);
  const industry = asString(value.industry);
  const location = asString(value.location);
  if (!slug || !name || !industry || !location) return null;

  return {
    slug,
    name,
    industry,
    location,
    logo: asNullableString(value.logo),
    countryCode: asString(value.countryCode) ?? undefined,
  };
}

function asPersonResult(value: unknown): LocusPersonResult | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name);
  const role = asString(value.role);
  const companySlug = asString(value.companySlug);
  const companyName = asString(value.companyName);
  if (!name || !role || !companySlug || !companyName) return null;

  return {
    name,
    role,
    companySlug,
    companyName,
    image: asNullableString(value.image),
    url: asNullableString(value.url),
    companyLogo: asNullableString(value.companyLogo),
    countryCode: asString(value.countryCode) ?? undefined,
  };
}

function asJobResult(value: unknown): LocusJobResult | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title);
  const focus = asString(value.focus);
  const location = asString(value.location);
  const companySlug = asString(value.companySlug);
  const companyName = asString(value.companyName);
  if (!title || !focus || !location || !companySlug || !companyName) {
    return null;
  }

  return {
    title,
    focus,
    companySlug,
    companyName,
    url: asNullableString(value.url),
    location,
    companyLogo: asNullableString(value.companyLogo),
    countryCode: asString(value.countryCode) ?? undefined,
  };
}

function asSearchResults(value: unknown): LocusSearchResults | null {
  if (!isRecord(value)) return null;
  const companies = Array.isArray(value.companies)
    ? value.companies.map(asCompanyResult).filter(Boolean)
    : [];
  const people = Array.isArray(value.people)
    ? value.people.map(asPersonResult).filter(Boolean)
    : [];
  const jobs = Array.isArray(value.jobs)
    ? value.jobs.map(asJobResult).filter(Boolean)
    : [];

  return companies.length || people.length || jobs.length
    ? {
        companies: companies as LocusCompanyResult[],
        people: people as LocusPersonResult[],
        jobs: jobs as LocusJobResult[],
      }
    : null;
}

function toolResultRows(
  type: string,
  output: unknown,
): LocusSearchResults | null {
  if (
    [
      "tool-searchLocus",
      "tool-presentLocusResults",
      "tool-queryJobs",
      "tool-queryCompanies",
      "tool-queryPeople",
    ].includes(type)
  ) {
    return asSearchResults(output);
  }

  if (
    (type === "tool-queryFunding" || type === "tool-queryActivity") &&
    isRecord(output) &&
    Array.isArray(
      type === "tool-queryFunding" ? output.rounds : output.activity,
    )
  ) {
    const rows = (
      type === "tool-queryFunding" ? output.rounds : output.activity
    ) as unknown[];
    const companies = rows
      .map(asCompanyResult)
      .filter(Boolean) as LocusCompanyResult[];
    const unique = [
      ...new Map(companies.map((company) => [company.slug, company])).values(),
    ];
    return unique.length ? { companies: unique, people: [], jobs: [] } : null;
  }

  if (type === "tool-recommendOutreachTargets" && Array.isArray(output)) {
    const companies = output
      .map(asCompanyResult)
      .filter(Boolean) as LocusCompanyResult[];
    return companies.length ? { companies, people: [], jobs: [] } : null;
  }

  if (type === "tool-listCompanyJobs" && Array.isArray(output)) {
    const jobs = output.map(asJobResult).filter(Boolean) as LocusJobResult[];
    return jobs.length ? { companies: [], people: [], jobs } : null;
  }

  if (
    (type === "tool-listCompanyPeople" || type === "tool-findCompanyPeople") &&
    Array.isArray(output)
  ) {
    const people = output
      .map(asPersonResult)
      .filter(Boolean) as LocusPersonResult[];
    return people.length ? { companies: [], people, jobs: [] } : null;
  }

  if (type === "tool-getCompany") {
    const company = asCompanyResult(output);
    return company ? { companies: [company], people: [], jobs: [] } : null;
  }

  return null;
}

type LocusMessageSegment =
  | { kind: "text"; key: string; streaming: boolean; text: string }
  | { kind: "trace"; key: string; trace: LocusTrace }
  | { kind: "results"; key: string; results: LocusSearchResults };

function ActivityPill({
  label,
  reduceMotion,
  inline = false,
}: {
  label: string;
  reduceMotion: boolean | null;
  inline?: boolean;
}) {
  return (
    <motion.div
      className={
        inline
          ? "flex w-fit items-center"
          : "flex h-8 w-fit items-center rounded-full border border-border bg-popover/85 px-3 backdrop-blur-sm dark:bg-popover/75"
      }
      layoutId="locus-activity-pill"
      layoutDependency={inline ? "inline" : "header"}
      transition={{
        layout: reduceMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.77, 0, 0.175, 1] },
      }}
    >
      <LocusActivityStatus label={label} />
    </motion.div>
  );
}

function toLocusSegments(parts: ReadonlyArray<unknown>): LocusMessageSegment[] {
  const segments: LocusMessageSegment[] = [];

  parts.forEach((part, index) => {
    if (!isRecord(part) || typeof part.type !== "string") return;

    if (part.type === "text") {
      const text = asString(part.text) ?? "";
      if (text.trim()) {
        segments.push({
          kind: "text",
          key: `text-${index}`,
          streaming: part.state === "streaming",
          text,
        });
      }
      return;
    }

    if (part.type === "data-pageContext" && isRecord(part.data)) {
      const name = asString(part.data.name);
      if (name) {
        segments.push({
          kind: "trace",
          key: `page-${index}`,
          trace: {
            icon: "company",
            phase: "complete",
            label: `Looking at ${name}`,
            logo: asString(part.data.logo) ?? undefined,
          },
        });
      }
      return;
    }

    if (!part.type.startsWith("tool-")) return;

    const trace = describeLocusTool(part);
    if (trace) {
      segments.push({ kind: "trace", key: `tool-${index}`, trace });
    }

    if (part.state === "output-available") {
      const results = toolResultRows(part.type, part.output);
      if (results) {
        segments.push({ kind: "results", key: `results-${index}`, results });
      }
    }
  });

  return segments;
}

function lastAssistantMessageContainsNavigation(messages: UIMessage[]) {
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  return lastAssistantMessage?.parts.some((part) => {
    if (!isRecord(part) || part.type !== "tool-navigateLocus") return false;
    const navigation = asLocusNavigation(part.input);
    // Same-page person focus is not a page departure; allow the model to
    // finish its answer after the navigation tool result is submitted.
    return !(
      navigation?.destination === "person" &&
      window.location.pathname === `/company/${navigation.companySlug}`
    );
  });
}

/**
 * Presentational chat launcher. A future AI SDK integration can own the input
 * state and submit behavior without changing this shell.
 */
export function LocusChat() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [focusState, setFocusState] = useState<
    "closed" | "launcher-exiting" | "open" | "panel-exiting"
  >("closed");
  const [input, setInput] = useState("");
  const [responseDurations, setResponseDurations] = useState<
    Record<string, number>
  >({});
  const [responseTimer] = useState(() => new LocusResponseTimer());
  const [activityVariant, setActivityVariant] = useState(0);
  const [activityStartedAt, setActivityStartedAt] = useState<number | null>(
    null,
  );
  const [isClearingChat, setIsClearingChat] = useState(false);
  const hasOpenedFocus = useRef(false);
  const resetTimer = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);
  const focusPanelRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const isPinnedToBottom = useRef(true);
  const [isScrolledAwayFromBottom, setIsScrolledAwayFromBottom] =
    useState(false);
  const [hasTranscriptOverflow, setHasTranscriptOverflow] = useState(false);
  const [modelId, setModelId] = useLocusModel();
  const modelIdRef = useRef(modelId);
  useLayoutEffect(() => {
    modelIdRef.current = modelId;
  }, [modelId]);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Also sent on automatic tool-call continuations, not just the first turn.
        body: () => ({
          pagePath: window.location.pathname,
          modelId: modelIdRef.current,
        }),
      }),
    [],
  );
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    error,
    clearError,
    addToolOutput,
  } = useChat({
    transport,
    onError: () => responseTimer.reset(),
    onFinish: ({
      message,
      messages: finishedMessages,
      isAbort,
      isDisconnect,
      isError,
      finishReason,
    }) => {
      const duration = responseTimer.finish({
        unsuccessful:
          isAbort || isDisconnect || isError || finishReason === "error",
        continues:
          lastAssistantMessageIsCompleteWithToolCalls({
            messages: finishedMessages,
          }) && !lastAssistantMessageContainsNavigation(finishedMessages),
      });
      if (duration !== null) {
        setResponseDurations((current) => ({
          ...current,
          [message.id]: duration,
        }));
      }
    },
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
      !lastAssistantMessageContainsNavigation(messages),
    onToolCall({ toolCall }) {
      if (toolCall.dynamic || toolCall.toolName !== "navigateLocus") return;

      const navigation = asLocusNavigation(toolCall.input);
      if (!navigation) {
        addToolOutput({
          tool: "navigateLocus",
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: "Invalid Locus destination.",
        });
        return;
      }

      const { companySlug, destination } = navigation;
      const href =
        destination === "person"
          ? personDetailsHref({
              companySlug,
              name: navigation.personName,
              url: navigation.personUrl,
            })
          : destination === "job"
            ? jobDetailsHref({
                companySlug,
                title: navigation.jobTitle,
                location: navigation.jobLocation,
              })
            : `/company/${companySlug}`;

      const samePagePerson =
        destination === "person" &&
        window.location.pathname === `/company/${companySlug}`;
      if (!samePagePerson) setFocusState("panel-exiting");
      startNavigation(() => {
        router.push(href);
      });
      addToolOutput({
        tool: "navigateLocus",
        toolCallId: toolCall.toolCallId,
        output: { href, ...navigation },
      });
    },
  });
  const isBusy = status === "submitted" || status === "streaming";
  const isActivityActive = isBusy || isNavigating;
  const reduceMotion = useReducedMotion();
  const isOpen = focusState === "open" || focusState === "panel-exiting";
  const activityLabel = isNavigating
    ? "Navigating"
    : getLocusActivityLabel(
        messages,
        typeof window !== "undefined" ? window.location.pathname : undefined,
        activityVariant,
      );
  const latestMessage = messages.at(-1);
  const hasResponseStarted =
    latestMessage?.role === "assistant" &&
    latestMessage.parts.some(
      (part) =>
        part.type === "text" ||
        part.type.startsWith("tool-") ||
        part.type === "data-pageContext",
    );
  const showTopActivity = isNavigating || (isBusy && hasResponseStarted);
  const showInlineActivity = isBusy && !hasResponseStarted && !error;
  const pillInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: "translateY(4px) scale(0.96)" };
  const pillExit = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: "translateY(2px) scale(0.98)" };
  const clearedMessages = reduceMotion
    ? {
        height: 0,
        marginBottom: 0,
        opacity: 0,
        paddingBottom: 0,
        paddingTop: 0,
      }
    : {
        height: 0,
        marginBottom: 0,
        opacity: 0,
        paddingBottom: 0,
        paddingTop: 0,
        transform: "translateY(6px)",
      };

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const messageList = messageListRef.current;
    if (!messageList) return;

    isPinnedToBottom.current = true;
    setIsScrolledAwayFromBottom(false);
    if (messageList.scrollHeight <= messageList.clientHeight + 1) return;
    messageList.scrollTo({ top: messageList.scrollHeight, behavior });
  }, []);

  const handleMessageScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const messageList = event.currentTarget;
      const isAtBottom =
        messageList.scrollHeight -
          messageList.scrollTop -
          messageList.clientHeight <=
        24;

      isPinnedToBottom.current = isAtBottom;
      setIsScrolledAwayFromBottom((wasScrolledAway) =>
        wasScrolledAway === !isAtBottom ? wasScrolledAway : !isAtBottom,
      );
    },
    [],
  );

  useEffect(() => {
    if (isActivityActive) {
      setActivityStartedAt((startedAt) => startedAt ?? Date.now());
    } else {
      setActivityStartedAt(null);
    }
  }, [isActivityActive]);

  // Keep an unnecessary scrolling container out of the layout. Besides being
  // visually quieter, this prevents browsers from briefly revealing its
  // scrollbar while a short follow-up message is being measured.
  useLayoutEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) {
      setHasTranscriptOverflow(false);
      return;
    }

    setHasTranscriptOverflow(
      messageList.scrollHeight > messageList.clientHeight + 1,
    );
  }, [error, messages, responseDurations]);

  // Streaming changes the transcript many times per response. Keep it pinned
  // only while the reader is already at the latest message; scrolling up is an
  // explicit opt-out until they reach the bottom or press the jump control.
  useEffect(() => {
    if (!isOpen || !isPinnedToBottom.current) return;

    const frame = window.requestAnimationFrame(() => scrollToLatest("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [error, isBusy, isOpen, messages, responseDurations, scrollToLatest]);

  // The status/New pill lives above the panel, so keep both inside one ref.
  // Focus-owned portals also belong to this click zone. A press anywhere else
  // dismisses Focus without stealing presses from its controls.
  useEffect(() => {
    if (focusState !== "open") return;

    function handlePointerDown(event: PointerEvent) {
      const focusPanel = focusPanelRef.current;
      if (
        event.button !== 0 ||
        !focusPanel ||
        isLocusFocusClickZone(event.composedPath(), focusPanel)
      ) {
        return;
      }

      setFocusState("panel-exiting");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [focusState]);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest("[data-locus-focus-click-zone]"))
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setFocusState((state) =>
          state === "closed"
            ? "launcher-exiting"
            : state === "open"
              ? "panel-exiting"
              : state,
        );
      }

      if (event.key === "Escape") {
        setFocusState((state) => (state === "open" ? "panel-exiting" : state));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function getSessionId() {
    sessionId.current ??= crypto.randomUUID();
    return sessionId.current;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;

    isPinnedToBottom.current = true;
    setIsScrolledAwayFromBottom(false);
    const nextPhraseOffset =
      1 + Math.floor(Math.random() * (LOCUS_ACTIVITY_VARIANT_COUNT - 1));
    setActivityVariant(
      (current) => (current + nextPhraseOffset) % LOCUS_ACTIVITY_VARIANT_COUNT,
    );
    setActivityStartedAt(Date.now());
    responseTimer.start();
    sendMessage({ text }, { body: { sessionId: getSessionId() } });
    setInput("");
  }

  function startNewChat() {
    if (isClearingChat) return;

    setIsClearingChat(true);
  }

  function finishNewChat() {
    if (!isClearingChat) return;

    setMessages([]);
    responseTimer.reset();
    setResponseDurations({});
    clearError();
    setInput("");
    isPinnedToBottom.current = true;
    setIsScrolledAwayFromBottom(false);
    sessionId.current = null;
    resetTimer.current = window.setTimeout(() => {
      setIsClearingChat(false);
      resetTimer.current = null;
    }, 180);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center">
        {isOpen ? (
          <div className="w-full" ref={focusPanelRef}>
            <LayoutGroup>
              <motion.div
                animate={
                  focusState === "panel-exiting"
                    ? {
                        opacity: 0,
                        transform: reduceMotion ? "none" : "translateY(6px)",
                      }
                    : { opacity: 1, transform: "translateY(0)" }
                }
                className="mb-2 w-full"
                initial={{
                  opacity: 0,
                  transform: reduceMotion ? "none" : "translateY(6px)",
                }}
                onAnimationComplete={() => {
                  if (focusState === "panel-exiting") {
                    setFocusState("closed");
                  }
                }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
                {(showTopActivity ||
                  (!isBusy && messages.length > 0) ||
                  isClearingChat) && (
                  <div
                    className="mb-2 flex h-7 items-center"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <AnimatePresence initial={false}>
                      {showTopActivity ? (
                        activityStartedAt ? (
                          <motion.div
                            animate={{ opacity: 1 }}
                            className="mr-auto"
                            exit={pillExit}
                            initial={false}
                            key="activity"
                            transition={{
                              duration: 0.18,
                              ease: [0.23, 1, 0.32, 1],
                            }}
                          >
                            <ActivityPill
                              label={activityLabel}
                              reduceMotion={reduceMotion}
                            />
                          </motion.div>
                        ) : null
                      ) : messages.length > 0 || isClearingChat ? (
                        <motion.div
                          animate={
                            isClearingChat
                              ? pillExit
                              : {
                                  opacity: 1,
                                  transform: "translateY(0) scale(1)",
                                }
                          }
                          className="ml-auto"
                          exit={pillExit}
                          initial={pillInitial}
                          key="new-chat"
                          transition={{
                            duration: 0.18,
                            ease: [0.23, 1, 0.32, 1],
                          }}
                        >
                          <Button
                            className="h-8 gap-1.5 rounded-full border border-border bg-popover/85 px-3 text-sm text-muted-foreground backdrop-blur-sm hover:bg-muted hover:text-foreground dark:bg-popover/75"
                            disabled={isClearingChat}
                            onClick={startNewChat}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <PlusIcon
                              aria-hidden="true"
                              className="size-3.5 stroke-2"
                            />
                            New
                          </Button>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                )}
                <motion.section
                  aria-label="Ask Locus"
                  className="w-full rounded-xl! bg-popover/95 p-2 text-popover-foreground shadow-2xl shadow-emerald-500/10 ring-1 ring-border backdrop-blur-sm dark:bg-popover/75 dark:shadow-emerald-500/15"
                  style={{ transformOrigin: "bottom center" }}
                >
                  {(messages.length > 0 || error) && (
                    <motion.div
                      animate={
                        isClearingChat
                          ? clearedMessages
                          : { opacity: 1, transform: "translateY(0)" }
                      }
                      className="mb-3 h-fit max-h-72 space-y-5 px-1 py-2 sm:max-h-[min(26rem,calc(100dvh-12rem))]"
                      initial={false}
                      onScroll={handleMessageScroll}
                      onAnimationComplete={finishNewChat}
                      ref={messageListRef}
                      style={{
                        overflowY: hasTranscriptOverflow ? "auto" : "hidden",
                      }}
                      transition={{
                        duration: 0.18,
                        ease: [0.23, 1, 0.32, 1],
                      }}
                    >
                      {messages.map((message) => {
                        const text = message.parts
                          .filter((part) => part.type === "text")
                          .map((part) => part.text)
                          .join("");
                        const isShortUserMessage =
                          message.role === "user" &&
                          text.length <= 48 &&
                          !text.includes("\n");
                        const segments =
                          message.role === "assistant"
                            ? toLocusSegments(message.parts)
                            : [];

                        if (message.role === "user") {
                          if (!text) return null;
                          return (
                            <motion.div
                              animate={{ opacity: 1 }}
                              className={`ml-auto w-fit max-w-[80%] bg-emerald-500/10 px-4 py-2 text-emerald-950 backdrop-blur-sm dark:bg-emerald-400/10 dark:text-emerald-100 ${isShortUserMessage ? "rounded-full" : "rounded-2xl"}`}
                              initial={{ opacity: 0 }}
                              key={message.id}
                            >
                              <p className="break-words whitespace-pre-wrap text-[15px] leading-6">
                                {text}
                              </p>
                            </motion.div>
                          );
                        }

                        if (!segments.length) return null;

                        return (
                          <div className="w-full" key={message.id}>
                            {segments.map((segment, index) => {
                              const previous = segments[index - 1];
                              const spacing = !previous
                                ? ""
                                : previous.kind === "text" ||
                                    segment.kind === "text"
                                  ? "mt-3"
                                  : "mt-1";
                              if (segment.kind === "text") {
                                return (
                                  <div
                                    className={`w-full px-2 ${spacing}`}
                                    key={segment.key}
                                  >
                                    <Streamdown
                                      animated={false}
                                      className="break-words text-[15px] leading-6 [&>*]:first:mt-0 [&>*]:last:mb-0 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_p]:my-2 [&_pre]:text-sm [&_table]:text-sm"
                                      mode={
                                        segment.streaming
                                          ? "streaming"
                                          : "static"
                                      }
                                    >
                                      {segment.text}
                                    </Streamdown>
                                  </div>
                                );
                              }

                              if (segment.kind === "trace") {
                                return (
                                  <div className={spacing} key={segment.key}>
                                    <LocusTraceRow trace={segment.trace} />
                                  </div>
                                );
                              }

                              if (segment.kind === "results") {
                                return (
                                  <div className={spacing} key={segment.key}>
                                    <LocusResultRows
                                      {...segment.results}
                                      onNavigate={() =>
                                        setFocusState("panel-exiting")
                                      }
                                    />
                                  </div>
                                );
                              }

                              return null;
                            })}
                            {responseDurations[message.id] !== undefined ? (
                              <p className="mt-2 px-2 font-mono text-[11px] leading-4 text-muted-foreground tabular-nums">
                                Done in{" "}
                                {responseDurations[message.id].toFixed(1)}s
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                      {showInlineActivity && activityStartedAt ? (
                        <div className="px-2" key="pending-activity">
                          <ActivityPill
                            label={activityLabel}
                            reduceMotion={reduceMotion}
                            inline
                          />
                        </div>
                      ) : null}
                      {error ? (
                        <p
                          className="px-2 text-sm text-destructive"
                          role="alert"
                        >
                          {error.message}
                        </p>
                      ) : null}
                    </motion.div>
                  )}
                  <motion.form className="relative" onSubmit={submit}>
                    {messages.length > 0 ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-2">
                        <button
                          aria-label="Jump to latest"
                          className={`cursor-pointer rounded-full border border-border/70 bg-card/90 shadow-xs backdrop-blur-md transition-[opacity,translate,scale] duration-150 ease-out will-change-[translate,opacity] hover:bg-muted active:scale-[0.98] motion-reduce:translate-y-0 motion-reduce:transition-opacity motion-reduce:active:scale-100 ${
                            isScrolledAwayFromBottom
                              ? "pointer-events-auto translate-y-0 opacity-100"
                              : "pointer-events-none translate-y-0.5 opacity-0"
                          }`}
                          onClick={() => scrollToLatest()}
                          title="Jump to latest"
                          type="button"
                        >
                          <span className="flex h-9 w-12 items-center justify-center text-foreground">
                            <ArrowDown aria-hidden="true" className="size-5" />
                          </span>
                        </button>
                      </div>
                    ) : null}
                    <InputGroup className="h-10! rounded-lg! border-transparent bg-transparent shadow-none! ring-0 focus-within:border-transparent focus-within:ring-0 has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-transparent! has-[[data-slot=input-group-control]:focus-visible]:ring-0! dark:bg-transparent dark:has-disabled:bg-transparent">
                      <InputGroupAddon>
                        <LocusModelPicker
                          modelId={modelId}
                          onChange={setModelId}
                          disabled={isBusy}
                        />
                      </InputGroupAddon>
                      <InputGroupInput
                        aria-label="Message Locus"
                        autoComplete="off"
                        autoFocus
                        className="text-base!"
                        disabled={isBusy}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Ask about a company, person, or role…"
                        value={input}
                      />
                      <InputGroupButton
                        aria-label={isBusy ? "Stop response" : "Send message"}
                        className="mr-1 text-muted-foreground"
                        disabled={!isBusy && !input.trim()}
                        size="icon-sm"
                        type={isBusy ? "button" : "submit"}
                        onClick={isBusy ? stop : undefined}
                      >
                        {isBusy ? (
                          <SquareIcon className="size-4 stroke-2 opacity-70" />
                        ) : (
                          <ArrowUpIcon className="size-5" />
                        )}
                      </InputGroupButton>
                    </InputGroup>
                  </motion.form>
                </motion.section>
              </motion.div>
            </LayoutGroup>
          </div>
        ) : (
          <motion.div
            className="mb-1"
            animate={
              focusState === "launcher-exiting"
                ? {
                    opacity: 0,
                    transform: reduceMotion ? "none" : "translateY(8px)",
                  }
                : { opacity: 1, transform: "translateY(0)" }
            }
            initial={
              hasOpenedFocus.current
                ? {
                    opacity: 0,
                    transform: reduceMotion ? "none" : "translateY(8px)",
                  }
                : false
            }
            onAnimationComplete={() => {
              if (focusState === "launcher-exiting") {
                hasOpenedFocus.current = true;
                setFocusState("open");
              }
            }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          >
            <Button
              aria-expanded={isOpen}
              aria-keyshortcuts="Meta+J Control+J"
              className="h-9 rounded-full border border-border backdrop-blur-sm bg-popover/85 dark:bg-popover/75 px-3.5 shadow-xl shadow-emerald-500/7 dark:shadow-emerald-500/6 hover:bg-muted/75!"
              onClick={() => setFocusState("launcher-exiting")}
              type="button"
              variant="outline"
            >
              <LensConcaveIcon
                aria-hidden="true"
                className="size-4 stroke-[1.5] text-muted-foreground"
              />
              <span>Locus Focus</span>
              <KbdGroup className="ml-1 hidden sm:inline-flex">
                <Kbd>⌘</Kbd>
                <Kbd>J</Kbd>
              </KbdGroup>
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
