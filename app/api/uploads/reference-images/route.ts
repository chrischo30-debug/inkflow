import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET_NAME = "reference-images";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 8;
const ALLOWED_MIME_PREFIXES = ["image/"];

let hasEnsuredBucket = false;

async function ensureBucket() {
  if (hasEnsuredBucket) return;
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;
  const exists = (buckets ?? []).some((bucket) => bucket.name === BUCKET_NAME);
  if (!exists) {
    const { error: createError } = await admin.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
      allowedMimeTypes: ["image/*"],
    });
    if (createError) throw createError;
  }
  hasEnsuredBucket = true;
}

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const artistId = String(formData.get("artist_id") ?? "").trim();
    if (!artistId) {
      return NextResponse.json({ error: "artist_id is required" }, { status: 400 });
    }

    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files were provided." }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Please upload up to ${MAX_FILES_PER_REQUEST} files at a time.` },
        { status: 400 }
      );
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Total upload size is too large. Keep uploads under 20MB total." },
        { status: 400 }
      );
    }

    await ensureBucket();
    const admin = createAdminClient();
    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type || "unknown"}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 5MB max size.` },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const safeName = sanitizeFileName(file.name || "upload");
      const path = `${artistId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET_NAME)
        .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(path);
      if (publicUrlData?.publicUrl) {
        urls.push(publicUrlData.publicUrl);
      }
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (error: unknown) {
    console.error("Reference image upload error:", error);
    return NextResponse.json({ error: "Failed to upload files." }, { status: 500 });
  }
}
