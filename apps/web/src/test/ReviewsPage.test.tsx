import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/api";
import { ReviewsPage } from "../pages/ReviewsPage";

describe("ReviewsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when there is no pending review", async () => {
    vi.spyOn(apiClient, "myReviews").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 1
    });
    vi.spyOn(apiClient, "users").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
      totalPages: 1
    });

    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("暂无待处理评审")).toBeTruthy();
  });
});
