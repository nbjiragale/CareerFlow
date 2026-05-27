// CAREERFLOW: regression tests for the deleteFile authorization fix. A file may
// only be deleted when it is linked to a resume the current user owns — the
// upload route accepts a client-supplied fileId, so an unscoped delete let any
// user remove another user's file.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: { file: { findFirst: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("fs", () => ({
  default: { existsSync: vi.fn(() => true), unlinkSync: vi.fn() },
}));

import db from "@/lib/db";
import fs from "fs";
import { getCurrentUser } from "@/utils/user.utils";
import { deleteFile } from "@/actions/profile.actions";

const mc = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const findFirst = mc((db as unknown as { file: { findFirst: unknown } }).file.findFirst);
const del = mc((db as unknown as { file: { delete: unknown } }).file.delete);
const unlink = mc((fs as unknown as { unlinkSync: unknown }).unlinkSync);
const currentUser = mc(getCurrentUser);

describe("deleteFile authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue({ id: "owner-1" });
  });

  it("scopes the lookup to a resume owned by the current user", async () => {
    findFirst.mockResolvedValue({ id: "f1", filePath: "/data/cv.pdf" });
    await deleteFile("f1");

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "f1", Resume: { profile: { userId: "owner-1" } } },
    });
  });

  it("does NOT delete a file the user does not own", async () => {
    findFirst.mockResolvedValue(null); // victim's file isn't linked to this user
    await deleteFile("victim-file-id");

    expect(unlink).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes the file (disk + row) when the user owns it", async () => {
    findFirst.mockResolvedValue({ id: "f1", filePath: "/data/cv.pdf" });
    await deleteFile("f1");

    expect(unlink).toHaveBeenCalledWith("/data/cv.pdf");
    expect(del).toHaveBeenCalledWith({ where: { id: "f1" } });
  });
});
