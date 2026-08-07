import axiosInstance from "@/lib/api/axiosInstance";
import type { NavigationSection } from "@/types";

export const navigationApi = {
  /**
   * The sidebar this user should see, already permission-filtered.
   *
   * No permission of its own beyond being signed in — a user with no admin
   * permissions still gets a Dashboard link, so the endpoint returns *less*
   * rather than refusing.
   */
  get: () =>
    axiosInstance.get<{ sections: NavigationSection[] }>("/navigation"),
};
