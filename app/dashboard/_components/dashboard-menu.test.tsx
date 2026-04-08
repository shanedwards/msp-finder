import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardMenu } from "@/app/dashboard/_components/dashboard-menu";

describe("DashboardMenu", () => {
  it("renders Menu button", () => {
    render(<DashboardMenu />);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  it("opens dropdown when Menu is clicked", () => {
    render(<DashboardMenu />);
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
  });

  it("closes dropdown when Dashboard link is clicked", () => {
    render(<DashboardMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <DashboardMenu />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});
