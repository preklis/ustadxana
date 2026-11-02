import "server-only";
import { cache } from "react";
import { db } from "./db";

export const getActiveSeason = cache(async () => {
  return (
    (await db.season.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } })) ??
    (await db.season.findFirst({ orderBy: { createdAt: "desc" } }))
  );
});
