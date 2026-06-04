import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireJson, safeParseJson, requireString, apiHandler, limitBodySize, sanitizeText } from "@/lib/api-security";

const SYSTEM_PROMPT = `You are SharpConnect AI, an operational copilot for a TikTok marketing agency. Your role is to help manage campaigns, editors, deadlines, and workflow.

RULES:
- You NEVER approve payments, delete campaigns, or execute destructive actions.
- You only analyze provided data and give recommendations.
- Keep responses concise, data-driven, and actionable (2-4 sentences unless asked for detail).
- Focus on: campaign tracking, editor management, posting reminders, workflow monitoring, operational summaries.
- Use bullet points only when listing 3+ items.
- Reference specific campaign IDs, editor names, and statuses from the data.
- If data is insufficient for the question, say so directly.
- Never invent data not provided in the context.`;

const MAX_QUERY_LENGTH = 5000;
const MAX_CONTEXT_LENGTH = 50000;

export async function POST(req: NextRequest) {
  return apiHandler(req, async () => {
    const auth = requireRole(req, "super_admin", "admin");
    if (auth instanceof NextResponse) return auth;

    const size = await limitBodySize(req);
    if (size instanceof NextResponse) return size;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const json = requireJson(req);
    if (json instanceof NextResponse) return json;

    const body = await safeParseJson(req);
    if (body instanceof NextResponse) return body;

    const query = requireString(body.query, "query");
    if (query instanceof NextResponse) return query;
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: "Query too long" }, { status: 400 });
    }

    const context = typeof body.context === "string" ? sanitizeText(body.context, MAX_CONTEXT_LENGTH) : "";

    const userPrompt = context
      ? `## Current Dashboard Data\n${context}\n\n## User Question\n${query}`
      : query;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      return NextResponse.json({ error: "AI returned no response" }, { status: 502 });
    }

    return NextResponse.json({ response: text });
  }, "ai");
}
