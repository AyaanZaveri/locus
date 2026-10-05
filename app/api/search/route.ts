import { search } from "@/lib/search";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  // CMD+K is lexical navigation. Conceptual retrieval belongs in Focus.
  return Response.json(await search(query));
}
