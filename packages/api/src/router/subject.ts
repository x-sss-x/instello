import { and, desc, eq } from "@instello/db";
import { CreateSubjectSchema, subject } from "@instello/db/schema";
import { z } from "zod/v4";

import { branchProcedure, hasPermission } from "../trpc";

export const subjectRouter = {
  create: branchProcedure
    .use(hasPermission({ permission: "org:subjects:create" }))
    .input(CreateSubjectSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .insert(subject)
        .values({ ...input, semesterValue: ctx.auth.activeSemester.value });
    }),

  /**
   * ***List of subjects***
   *  @role Admin: Can see all subjects within the branch & semester
   *  @role Staff: Can see his/her assigned subjects only
   * */
  list: branchProcedure.query(async ({ ctx, input }) => {
    const isStaff = ctx.auth.orgRole == "org:staff";

    return ctx.db.query.subject.findMany({
      where: and(
        eq(subject.branchId, input.branchId),
        eq(subject.semesterValue, ctx.auth.activeSemester.value),
        // If user  is staff of the organization fetch only alloted subjects
        isStaff ? eq(subject.staffClerkUserId, ctx.auth.userId) : undefined,
      ),
      orderBy: desc(subject.createdAt),
    });
  }),

  getBySubjectId: branchProcedure
    .input(z.object({ subjectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.subject.findFirst({
        where: and(
          eq(subject.branchId, input.branchId),
          eq(subject.semesterValue, ctx.auth.activeSemester.value),
          eq(subject.id, input.subjectId),
        ),
      });
    }),

  assignStaff: branchProcedure
    .use(hasPermission({ permission: "org:subjects:update" }))
    .input(
      z.object({
        staffClerkUserId: z.string().nullable().optional(),
        subjectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { branchId, staffClerkUserId, subjectId } = input;

      return ctx.db
        .update(subject)
        .set({ staffClerkUserId })
        .where(
          and(
            eq(subject.branchId, branchId),
            eq(subject.semesterValue, ctx.auth.activeSemester.value),
            eq(subject.id, subjectId),
          ),
        );
    }),
};
