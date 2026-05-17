import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateBlock } from "../components/StateBlock";

describe("StateBlock", () => {
  it("renders empty state text", () => {
    render(<StateBlock type="empty" title="暂无数据" description="请稍后再试" />);

    expect(screen.getByText("暂无数据")).toBeTruthy();
    expect(screen.getByText("请稍后再试")).toBeTruthy();
  });
});
