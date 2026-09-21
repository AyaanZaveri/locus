import { motion, useReducedMotion } from "motion/react";

import {
  LocusResultRow,
  type LocusCompanyResult,
  type LocusJobResult,
  type LocusPersonResult,
  type LocusSearchResults,
} from "@/components/locus-result-row";

export type {
  LocusCompanyResult,
  LocusJobResult,
  LocusPersonResult,
  LocusSearchResults,
};

function AnimatedRow({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{ opacity: 1, transform: "translateY(0)" }}
      initial={{
        opacity: 0,
        transform: reduceMotion ? "none" : "translateY(10px)",
      }}
      transition={{
        delay: reduceMotion ? 0 : index * 0.05,
        duration: 0.18,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export function LocusResultRows({
  companies,
  people,
  jobs,
  onNavigate,
}: LocusSearchResults & { onNavigate?: () => void }) {
  if (!companies.length && !people.length && !jobs.length) return null;

  return (
    <div className="w-full space-y-1">
      {companies.map((company, index) => (
        <AnimatedRow index={index} key={company.slug}>
          <LocusResultRow
            kind="company"
            onNavigate={onNavigate}
            result={company}
            variant="link"
          />
        </AnimatedRow>
      ))}
      {people.map((person, index) => (
        <AnimatedRow
          index={companies.length + index}
          key={`${person.companySlug}-${person.name}-${index}`}
        >
          <LocusResultRow
            kind="person"
            onNavigate={onNavigate}
            result={person}
            variant="link"
          />
        </AnimatedRow>
      ))}
      {jobs.map((job, index) => (
        <AnimatedRow
          index={companies.length + people.length + index}
          key={`${job.companySlug}-${job.title}-${job.location}-${index}`}
        >
          <LocusResultRow
            kind="job"
            onNavigate={onNavigate}
            result={job}
            variant="link"
          />
        </AnimatedRow>
      ))}
    </div>
  );
}
