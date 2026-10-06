export const PROFILE_ROLE_GROUPS = [
  {
    department: "Engineering",
    roles: [
      "Software engineer",
      "Frontend engineer",
      "Backend engineer",
      "Full-stack engineer",
      "Founding engineer",
      "Product engineer",
      "Mobile engineer",
      "iOS engineer",
      "Android engineer",
      "Developer tools engineer",
      "QA engineer",
      "Engineering manager",
      "Director of engineering",
      "VP of engineering",
      "CTO",
    ],
  },
  {
    department: "Infrastructure",
    roles: [
      "Platform engineer",
      "Infrastructure engineer",
      "DevOps engineer",
      "Site reliability engineer",
      "Cloud engineer",
      "Systems engineer",
    ],
  },
  {
    department: "Machine learning",
    roles: [
      "AI engineer",
      "Machine learning engineer",
      "Applied AI engineer",
      "AI research scientist",
      "Research engineer",
      "MLOps engineer",
    ],
  },
  {
    department: "Data & analytics",
    roles: [
      "Data engineer",
      "Data scientist",
      "Data analyst",
      "Analytics engineer",
      "Business intelligence analyst",
    ],
  },
  {
    department: "Design",
    roles: [
      "Product designer",
      "UX designer",
      "UI designer",
      "UX researcher",
      "Design engineer",
      "Brand designer",
      "Motion designer",
      "Design manager",
      "Head of design",
    ],
  },
  {
    department: "Product",
    roles: [
      "Product manager",
      "Technical product manager",
      "Product lead",
      "Head of product",
      "Chief product officer",
    ],
  },
  {
    department: "Security",
    roles: [
      "Security engineer",
      "Application security engineer",
      "Security analyst",
      "Trust & safety specialist",
      "Compliance specialist",
    ],
  },
  {
    department: "Marketing",
    roles: [
      "Growth marketer",
      "Product marketing manager",
      "Content marketer",
      "Brand marketer",
      "Performance marketer",
      "Marketing manager",
      "Head of marketing",
    ],
  },
  {
    department: "Sales & partnerships",
    roles: [
      "Account executive",
      "Sales development representative",
      "Sales engineer",
      "Solutions engineer",
      "Partnerships manager",
      "Account manager",
      "Head of sales",
    ],
  },
  {
    department: "Customer success",
    roles: [
      "Customer success manager",
      "Customer support specialist",
      "Technical support engineer",
      "Implementation specialist",
    ],
  },
  {
    department: "Developer relations",
    roles: [
      "Developer advocate",
      "Developer relations engineer",
      "Community manager",
    ],
  },
  {
    department: "Operations",
    roles: [
      "Business operations associate",
      "Operations manager",
      "Strategy & operations manager",
      "Chief of staff",
      "Program manager",
      "Project manager",
      "Founder",
      "COO",
    ],
  },
  {
    department: "People & recruiting",
    roles: [
      "Recruiter",
      "Technical recruiter",
      "People operations specialist",
      "HR business partner",
      "Head of people",
    ],
  },
  {
    department: "Finance",
    roles: [
      "Financial analyst",
      "Accountant",
      "Finance manager",
      "Controller",
      "CFO",
    ],
  },
  { department: "Legal", roles: ["Legal counsel", "General counsel"] },
  {
    department: "Hardware",
    roles: [
      "Hardware engineer",
      "Electrical engineer",
      "Mechanical engineer",
      "Robotics engineer",
      "Embedded software engineer",
    ],
  },
  {
    department: "Education",
    roles: [
      "Student",
      "Engineering intern",
      "Design intern",
      "Product intern",
      "Research intern",
    ],
  },
] as const;

export const PROFILE_ROLES = PROFILE_ROLE_GROUPS.flatMap(
  ({ department, roles }) => roles.map((label) => ({ label, department })),
);

export function getProfileRoleDepartment(role: string): string {
  return (
    PROFILE_ROLES.find(
      (item) => item.label.toLowerCase() === role.trim().toLowerCase(),
    )?.department ??
    (/\b(engineer|developer)\b/i.test(role) ? `${role} engineering` : role)
  );
}

export function searchProfileRoles(
  query: string,
  selected: string[] = [],
): string[] {
  const input = query.trim();
  const words = input.toLowerCase().split(/\s+/).filter(Boolean);
  const matches: string[] = PROFILE_ROLES.filter(({ label, department }) =>
    words.every((word) =>
      `${label} ${department}`.toLowerCase().includes(word),
    ),
  ).map(({ label }) => label);
  // Include resume-supplied/custom titles in the list so they remain selectable.
  for (const label of selected) {
    if (
      words.every((word) => label.toLowerCase().includes(word)) &&
      !matches.includes(label)
    )
      matches.push(label);
  }
  if (
    input &&
    !matches.some((label) => label.toLowerCase() === input.toLowerCase())
  )
    matches.push(input);
  return matches;
}
