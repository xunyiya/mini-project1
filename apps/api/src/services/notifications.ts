import crypto from "node:crypto";
import type { Notification } from "@collab/shared";
import { getStore } from "../data/store";

export type NotificationInput = {
  userId: string;
  title: string;
  content: string;
  type?: Notification["type"];
  entityType?: string;
  entityId?: string;
};

export function createNotification(input: NotificationInput) {
  const notification: Notification = {
    id: `notice_${crypto.randomUUID()}`,
    userId: input.userId,
    title: input.title,
    content: input.content,
    type: input.type ?? "approval",
    read: false,
    entityType: input.entityType,
    entityId: input.entityId,
    createdAt: new Date().toISOString(),
    isSeed: true
  };

  getStore().notifications.unshift(notification);
  return notification;
}

export function createNotifications(inputs: NotificationInput[]) {
  const seen = new Set<string>();

  return inputs
    .filter((input) => {
      const key = `${input.userId}:${input.title}:${input.entityType ?? ""}:${input.entityId ?? ""}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map(createNotification);
}
