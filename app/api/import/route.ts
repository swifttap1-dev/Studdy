"use server";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated with Google" },
        { status: 401 }
      );
    }

    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json(
        { error: "Missing fileId" },
        { status: 400 }
      );
    }

    // Authenticate using the user's OAuth token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: session.accessToken,
    });

    const drive = google.drive({ version: "v3", auth });

    // Get file metadata
    const fileMeta = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    const mime = fileMeta.data.mimeType;
    let text = "";

    // -----------------------------
    // GOOGLE-NATIVE FILE TYPES
    // -----------------------------

    // Google Docs → text
    if (mime === "application/vnd.google-apps.document") {
      const exported = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = exported.data as string;
    }

    // PDF → text (Google auto‑OCRs)
    else if (mime === "application/pdf") {
      const exported = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = exported.data as string;
    }

    // Google Slides → text
    else if (mime === "application/vnd.google-apps.presentation") {
      const exported = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = exported.data as string;
    }

    // Google Sheets → CSV
    else if (mime === "application/vnd.google-apps.spreadsheet") {
      const exported = await drive.files.export(
        { fileId, mimeType: "text/csv" },
        { responseType: "text" }
      );
      text = exported.data as string;
    }

    // Google Sites → cannot be exported
    else if (mime === "application/vnd.google-apps.site") {
      return NextResponse.json(
        { error: "Google Sites pages cannot be exported." },
        { status: 400 }
      );
    }

    // Shortcuts → not real files
    else if (mime === "application/vnd.google-apps.shortcut") {
      return NextResponse.json(
        { error: "This is a Google Drive shortcut, not a real file." },
        { status: 400 }
      );
    }

    // -----------------------------
    // NON-GOOGLE FILE TYPES (DOCX, PPTX, XLSX)
    // Must be converted first
    // -----------------------------

    // DOCX → convert to Google Doc → export as text
    else if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // 1. Convert DOCX → Google Doc
      const converted = await drive.files.copy({
        fileId,
        requestBody: {
          mimeType: "application/vnd.google-apps.document",
          name: fileMeta.data.name + " (Converted)"
        }
      });

      const newId = converted.data.id;

      // 2. Export Google Doc → text
      const exported = await drive.files.export(
        { fileId: newId!, mimeType: "text/plain" },
        { responseType: "text" }
      );

      text = exported.data as string;

      // 3. Delete temporary Google Doc
      await drive.files.delete({ fileId: newId! });
    }

    // PPTX → convert to Google Slides → export as text
    else if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      const converted = await drive.files.copy({
        fileId,
        requestBody: {
          mimeType: "application/vnd.google-apps.presentation",
          name: fileMeta.data.name + " (Converted)"
        }
      });

      const newId = converted.data.id;

      const exported = await drive.files.export(
        { fileId: newId!, mimeType: "text/plain" },
        { responseType: "text" }
      );

      text = exported.data as string;

      await drive.files.delete({ fileId: newId! });
    }

    // XLSX → convert to Google Sheets → export as CSV
    else if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      const converted = await drive.files.copy({
        fileId,
        requestBody: {
          mimeType: "application/vnd.google-apps.spreadsheet",
          name: fileMeta.data.name + " (Converted)"
        }
      });

      const newId = converted.data.id;

      const exported = await drive.files.export(
        { fileId: newId!, mimeType: "text/csv" },
        { responseType: "text" }
      );

      text = exported.data as string;

      await drive.files.delete({ fileId: newId! });
    }

    // -----------------------------
    // UNSUPPORTED FILE TYPES
    // -----------------------------
    else {
      return NextResponse.json(
        { error: `Unsupported file type: ${mime}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Drive import error:", error);
    return NextResponse.json(
      { error: "Failed to import file", details: error.message },
      { status: 500 }
    );
  }
}
