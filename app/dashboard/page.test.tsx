import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";

jest.mock("@/app/dashboard/_components/dashboard-menu", () => ({
  DashboardMenu: () => <div data-testid="dashboard-menu">Menu</div>,
}));

jest.mock("@/app/dashboard/_components/msp-dashboard", () => ({
  MspDashboard: () => <div data-testid="msp-dashboard">MSP Dashboard</div>,
}));

describe("Dashboard page", () => {
  it("renders msp dashboard shell", async () => {
    const content = await DashboardPage();
    render(content);

    expect(screen.getByTestId("msp-dashboard")).toBeInTheDocument();
  });

  it("renders dashboard menu", async () => {
    const content = await DashboardPage();
    render(content);

    expect(screen.getByTestId("dashboard-menu")).toBeInTheDocument();
  });
});
