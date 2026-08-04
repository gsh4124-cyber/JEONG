import { NextResponse } from "next/server";
import { auth } from "@/auth";

function decodeBase64Url(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getHeader(headers: Array<{ name: string; value: string }> = [], name: string) {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Google login required" }, { status: 401 });
  }

  const listParams = new URLSearchParams({
    q: "in:inbox newer_than:7d",
    maxResults: "15"
  });

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store"
    }
  );

  if (!listResponse.ok) {
    return NextResponse.json(
      { error: "Gmail request failed", detail: await listResponse.text() },
      { status: listResponse.status }
    );
  }

  const listData = await listResponse.json();
  const ids = (listData.messages ?? []).map((message: any) => message.id);

  const messages = await Promise.all(
    ids.map(async (id: string) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: "no-store"
        }
      );

      if (!response.ok) return null;
      const data = await response.json();
      const headers = data.payload?.headers ?? [];

      return {
        id: data.id,
        threadId: data.threadId,
        from: getHeader(headers, "From"),
        subject: getHeader(headers, "Subject") || "(제목 없음)",
        date: getHeader(headers, "Date"),
        snippet: data.snippet ? decodeBase64Url(data.snippet) : ""
      };
    })
  );

  return NextResponse.json({ messages: messages.filter(Boolean) });
}
