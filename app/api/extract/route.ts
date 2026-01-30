"use server";

import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { fileBuffer } = await req.json();

    if (!fileBuffer || !Array.isArray(fileBuffer)) {
      return NextResponse.json(
        { error: "Invalid fileBuffer provided" },
        { status: 400 }
      );
    }

    const uint8 = new Uint8Array(fileBuffer);

    // Auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

// 1. Upload PDF to Drive
const uploadRes = await drive.files.create({
  requestBody: {
    name: "upload.pdf",
    mimeType: "application/pdf",
  },
  media: {
    mimeType: "application/pdf",
    body: Buffer.from(uint8),
  },
  fields: "id",
});

const fileId = uploadRes.data.id;
if (!fileId) {
  return NextResponse.json(
    { error: "Upload failed: no fileId returned" },
    { status: 500 }
  );
}

// 2. Convert PDF → Google Doc
const convertRes = await drive.files.copy({
  fileId,
  requestBody: {
    mimeType: "application/vnd.google-apps.document",
  },
  fields: "id",
});


    const docId = convertRes.data.id;

    // 3. Export Google Doc as plain text
    const exportRes = await drive.files.export(
      {
        fileId: docId!,
        mimeType: "text/plain",
      },
      { responseType: "text" }
    );

    const text = exportRes.data as string;

    // Cleanup (optional)
    await drive.files.delete({ fileId });

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Google extract error:", error);
    return NextResponse.json(
      { error: "Failed to extract PDF text" },
      { status: 500 }
    );
  }
}
