import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/api";
import { RequirementListPage } from "../pages/RequirementListPage";

describe("RequirementListPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders empty state for an empty requirement pool", async () => {
    vi.spyOn(apiClient, "departments").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
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
    vi.spyOn(apiClient, "requirements").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1
    });

    render(
      <MemoryRouter>
        <RequirementListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("暂无需求，点击新建需求")).toBeTruthy();
  });

  it("switches to draft view from the draft button", async () => {
    vi.spyOn(apiClient, "departments").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
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
    const requirementsSpy = vi.spyOn(apiClient, "requirements").mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1
    });

    render(
      <MemoryRouter>
        <RequirementListPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("查看草稿"));

    await screen.findByText("我的草稿");
    await screen.findByText("暂无草稿，点击新建需求");
    await waitFor(() =>
      expect(requirementsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "DRAFT",
          page: 1,
          pageSize: 10
        })
      )
    );
  });
});
