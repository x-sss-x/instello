import { and, desc, eq, isDrizzleQueryError } from "@instello/db";
import {
  CreateTimetableSchema,
  CreateTimetableSlotsSchema,
  timetable,
  timetableSlot,
} from "@instello/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { branchProcedure } from "../trpc";

export const timetableRouter = {
  /** Create new time table */
  create: branchProcedure
    .input(
      CreateTimetableSchema.and(
        z.object({ slots: z.array(CreateTimetableSlotsSchema) }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const { slots, branchId, effectiveFrom, message } = input;

      await ctx.db.transaction(async (tx) => {
        try {
          const last = await tx.query.timetable.findFirst({
            where: eq(timetable.id, branchId),
            orderBy: desc(timetable.version),
          });

          const version = last ? last.version + 1 : 1;

          const newTimetable = await tx
            .insert(timetable)
            .values({
              effectiveFrom,
              message,
              version,
              branchId,
              semesterId: ctx.auth.activeSemester.id,
            })
            .returning()
            .then((r) => r.at(0));

          if (!newTimetable)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Couldn't able to create timetable right now",
            });

          const slotsWithTimetable = slots.map((s) => ({
            ...s,
            timetableId: newTimetable.id,
          }));

          await tx.insert(timetableSlot).values(slotsWithTimetable).returning();
        } catch (e) {
          // Rollback the changes
          tx.rollback();

          if (isDrizzleQueryError(e))
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: e.cause.message,
            });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create timetable right now",
          });
        }
      });
    }),

  /** Get current time table within branch and active semester */
  findByActiveSemester: branchProcedure.query(async ({ ctx, input }) => {
    const timetableData = await ctx.db.query.timetable.findFirst({
      where: and(
        eq(timetable.branchId, input.branchId),
        eq(timetable.semesterId, ctx.auth.activeSemester.id),
      ),
      orderBy: ({ createdAt }, { desc }) => [desc(createdAt)],
      with: { timetableSlots: true },
    });

    return { timetableData };
  }),

  /** Get all timetable version history within the branch*/
  findAllByBatchId: branchProcedure.query(({ ctx, input }) =>
    ctx.db.query.timetable.findMany({
      where: and(
        eq(timetable.branchId, input.branchId),
        eq(timetable.semesterId, ctx.auth.activeSemester.id),
      ),
      orderBy: ({ createdAt }, { desc }) => [desc(createdAt)],
    }),
  ),
};
