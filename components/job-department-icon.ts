import {
  BrainCircuit,
  ChartNoAxesCombined,
  Code2,
  Cpu,
  FlaskConical,
  Handshake,
  Headset,
  Landmark,
  Megaphone,
  MessagesSquare,
  PanelsTopLeft,
  PenTool,
  Scale,
  ServerCog,
  ShieldCheck,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

// Department names vary between job boards. Match specific disciplines before
// broad groups such as Engineering or Operations.
const departmentIcons: { pattern: RegExp; icon: LucideIcon }[] = [
  {
    pattern: /\b(security|trust\s*&\s*safety|fraud|vulnerability|grc)\b/i,
    icon: ShieldCheck,
  },
  { pattern: /\b(design|creative|ux|ui)\b/i, icon: PenTool },
  {
    pattern:
      /\b(data (?:analyst|engineer|science|scientist)|analytics|business intelligence)\b/i,
    icon: ChartNoAxesCombined,
  },
  { pattern: /\b(research|science|scientist|modeling)\b/i, icon: FlaskConical },
  {
    pattern: /\b(machine learning|applied ai|ai research)\b/i,
    icon: BrainCircuit,
  },
  {
    pattern: /\b(product|epd)\b/i,
    icon: PanelsTopLeft,
  },
  { pattern: /\b(counsel|legal|attorney|paralegal|lawyer)\b/i, icon: Scale },
  {
    pattern:
      /\b(finance|financial|accounting|accountant|controller|payroll|tax)\b/i,
    icon: Landmark,
  },
  {
    pattern: /\b(recruit(?:er|ing)|talent|people|human resources|hrbp)\b/i,
    icon: UsersRound,
  },
  {
    pattern: /\b(developer relations|devrel|community)\b/i,
    icon: MessagesSquare,
  },
  {
    pattern:
      /\b(customer success|customer support|technical support|developer success|client experience|user operations|support)\b/i,
    icon: Headset,
  },
  {
    pattern: /\b(marketing|brand|communications|growth)\b/i,
    icon: Megaphone,
  },
  {
    pattern: /\b(sales|go to market|gtm|revenue|partnerships|commercial)\b/i,
    icon: Handshake,
  },
  { pattern: /\b(hardware|devices|compute|manufacturing)\b/i, icon: Cpu },
  {
    pattern: /\b(infrastructure|infra|platform|cloud)\b/i,
    icon: ServerCog,
  },
  {
    pattern: /\b(engineering|technology|technical staff)\b/i,
    icon: Code2,
  },
  { pattern: /\b(operations|program management|g&a)\b/i, icon: Workflow },
];

export function getJobDepartmentIcon(department: string): LucideIcon | null {
  return (
    departmentIcons.find(({ pattern }) => pattern.test(department))?.icon ??
    null
  );
}
