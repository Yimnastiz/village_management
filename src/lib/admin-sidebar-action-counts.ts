import "server-only";

import {
  AppointmentStage,
  BindingRequestStatus,
  GalleryItemSubmissionStatus,
  IssueStage,
  NewsSubmissionStatus,
  VillageEventSubmissionStatus,
  VillagePlaceSubmissionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminSidebarActionCounts = {
  population: {
    total: number;
    bindingRequests: number;
    corrections: number;
  };
  news: number;
  gallery: number;
  calendar: number;
  appointments: number;
  issues: number;
  places: number;
  contacts: number;
};

/**
 * Counts only work that has arrived from residents and still needs an admin's
 * decision. Every query is scoped to the active admin village.
 */
export async function getAdminSidebarActionCounts(villageId: string): Promise<AdminSidebarActionCounts> {
  const [bindingRequests, news, gallery, calendar, appointments, issues, places, contacts] = await Promise.all([
    prisma.bindingRequest.count({
      where: { villageId, status: BindingRequestStatus.PENDING },
    }),
    prisma.newsSubmission.count({
      where: { villageId, status: NewsSubmissionStatus.PENDING },
    }),
    prisma.galleryItemSubmission.count({
      where: {
        status: GalleryItemSubmissionStatus.PENDING,
        album: { villageId },
      },
    }),
    prisma.villageEventSubmission.count({
      where: { villageId, status: VillageEventSubmissionStatus.PENDING },
    }),
    prisma.appointment.count({
      where: { villageId, stage: AppointmentStage.PENDING_APPROVAL },
    }),
    prisma.issue.count({
      where: { villageId, stage: { in: [IssueStage.OPEN, IssueStage.WAITING] } },
    }),
    prisma.villagePlaceSubmission.count({
      where: { villageId, status: VillagePlaceSubmissionStatus.PENDING },
    }),
    prisma.contactRequest.count({ where: { villageId, status: "PENDING" } }),
  ]);

  return {
    population: {
      total: bindingRequests,
      bindingRequests,
      // The schema has correction requests, but this admin sidebar has no
      // review route/workflow for them yet, so they are deliberately excluded.
      corrections: 0,
    },
    news,
    gallery,
    calendar,
    appointments,
    issues,
    places,
    contacts,
  };
}
