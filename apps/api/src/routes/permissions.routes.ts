import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth";
import { sendSuccess } from "../lib/response";
import {
  getAvailableActions,
  getPermissionCodes,
  getUserRoles,
  getVisibleMenus,
  reservedFieldPermissions
} from "../services/rbac";

export const permissionsRoutes = Router();

permissionsRoutes.get(
  "/summary",
  authenticate,
  requirePermission("api.permissions.summary.read"),
  (req, res, next) => {
    try {
      const user = req.currentUser!;
      const permissionCodes = getPermissionCodes(user);

      return sendSuccess(res, {
        roles: getUserRoles(user).map((role) => ({
          id: role.id,
          name: role.name,
          code: role.code
        })),
        permissionCodes,
        menus: getVisibleMenus(permissionCodes),
        buttons: getAvailableActions(permissionCodes),
        fields: reservedFieldPermissions
      });
    } catch (error) {
      next(error);
    }
  }
);
