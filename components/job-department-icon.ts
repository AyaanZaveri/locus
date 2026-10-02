import {
  Atom,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  ChartCandlestick,
  ChartNoAxesCombined,
  Code2,
  Cpu,
  Factory,
  FlaskConical,
  Globe2,
  GraduationCap,
  Handshake,
  Headset,
  Landmark,
  Megaphone,
  MessagesSquare,
  MonitorCog,
  PanelsTopLeft,
  PenTool,
  Scale,
  ScanEye,
  ServerCog,
  ShieldCheck,
  UsersRound,
  Workflow,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { briefcasePlus } from "@lucide/lab";

const BriefcasePlus = createLucideIcon("BriefcasePlus", briefcasePlus);

// Department names vary between job boards. Match specific disciplines before
// broad groups such as Engineering or Operations.
const departmentIcons: { pattern: RegExp; icon: LucideIcon }[] = [
  { pattern: /\b(create your own role)\b/i, icon: BriefcasePlus },
  { pattern: /\b(intern(?:ship)?s?|education)\b/i, icon: GraduationCap },
  {
    pattern: /\b(brokerage|capital markets|trading|kalshi prime)\b/i,
    icon: ChartCandlestick,
  },
  { pattern: /\b(nuclear)\b/i, icon: Atom },
  { pattern: /\b(factory|manufacturing)\b/i, icon: Factory },
  {
    pattern: /\b(intelligence & investigations|investigations)\b/i,
    icon: ScanEye,
  },
  { pattern: /\b(quality)\b/i, icon: BadgeCheck },
  { pattern: /\b(workplace)\b/i, icon: Building2 },
  { pattern: /\b(it|information technology)\b/i, icon: MonitorCog },
  {
    pattern: /\b(machine learning|applied ai|ai research|inference)\b/i,
    icon: BrainCircuit,
  },
  {
    pattern: /\b(people|talent|human resources|recruit(?:er|ing)|hrbp)\b/i,
    icon: UsersRound,
  },
  {
    pattern: /\b(program management|revenue operations|sales operations)\b/i,
    icon: Workflow,
  },
  {
    pattern:
      /\b(global affairs|government|gov|public affairs|public benefit|policy)\b/i,
    icon: Globe2,
  },
  {
    pattern:
      /\b(security|trust|safety|safeguards|risk|compliance|regulatory|fraud|vulnerability|grc)\b/i,
    icon: ShieldCheck,
  },
  { pattern: /\b(design|creative|ux|ui)\b/i, icon: PenTool },
  {
    pattern: /\b(data|analytics|business intelligence)\b/i,
    icon: ChartNoAxesCombined,
  },
  { pattern: /\b(research|science|scientist|modeling)\b/i, icon: FlaskConical },
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
    pattern: /\b(developer relations|devrel|community)\b/i,
    icon: MessagesSquare,
  },
  {
    pattern:
      /\b(customer success|customer support|technical support|developer success|client experience|user operations|user ops|support|success|cx|services)\b/i,
    icon: Headset,
  },
  {
    pattern: /\b(marketing|brand|communications?|growth|pr)\b/i,
    icon: Megaphone,
  },
  {
    pattern:
      /\b(sales|go[ -]to[ -]market|gtm|revenue|partnerships|commercial)\b/i,
    icon: Handshake,
  },
  { pattern: /\b(hardware|devices|compute|manufacturing)\b/i, icon: Cpu },
  {
    pattern: /\b(infrastructure|infra|platform|cloud|scaling)\b/i,
    icon: ServerCog,
  },
  {
    pattern: /\b(engineering|technology|technical staff|solutions)\b/i,
    icon: Code2,
  },
  { pattern: /\b(operations|general admin|g&a)\b/i, icon: Workflow },
  { pattern: /\b(general|other|business)\b/i, icon: BriefcaseBusiness },
];

export function hasSpecificJobDepartmentIcon(department: string): boolean {
  return departmentIcons.some(({ pattern }) => pattern.test(department.trim()));
}

export function getJobDepartmentIcon(department: string): LucideIcon {
  return (
    departmentIcons.find(({ pattern }) => pattern.test(department.trim()))
      ?.icon ?? BriefcaseBusiness
  );
}
