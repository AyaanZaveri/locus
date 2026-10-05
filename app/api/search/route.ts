import { search } from "@/lib/search";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const semantic = new URL(request.url).searchParams.get("semantic") === "1";
  return Response.json(await search(query, { semantic }));
}
