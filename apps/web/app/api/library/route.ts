import { NextResponse } from "next/server";
import { LibrarySchema, libraryToProfile } from "@offerben/core";
import { jsonHandler } from "@/lib/server";
import { HOME, listInbox, readLibrary, readLibraryState, saveLibrary } from "@/lib/library/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the Library view needs in one read. No AI. */
export async function GET() {
  try {
    const [library, inbox, state] = await Promise.all([
      readLibrary(),
      listInbox(),
      readLibraryState(),
    ]);
    return NextResponse.json({
      home: HOME,
      library,
      profile: libraryToProfile(library),
      inbox,
      drafts: state.drafts,
      fileCount: Object.keys(state.files).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read library." },
      { status: 500 },
    );
  }
}

/** Save the whole library (edits from the Library view). */
export const POST = jsonHandler<{ library: unknown }>(async (body) => {
  const library = await saveLibrary(LibrarySchema.parse(body.library ?? {}));
  return { library, profile: libraryToProfile(library) };
});
