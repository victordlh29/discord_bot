import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuildProvider, useGuild } from "./guild";
import { render, screen } from "@testing-library/react";

// Mock auth-store
vi.mock("./auth-store", () => ({
  getAdminGuildId: vi.fn(() => "guild-123"),
  getIsSuperAdmin: vi.fn(() => false),
}));

// Mock api
vi.mock("./api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: "guild-1", name: "Server 1" },
        { id: "guild-2", name: "Server 2" },
      ],
    }),
  },
}));

describe("GuildProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should render children", () => {
    render(
      <GuildProvider>
        <div>Child content</div>
      </GuildProvider>
    );
    expect(screen.getByText("Child content")).toBeDefined();
  });

  it("should provide guild context with default values", () => {
    function TestComponent() {
      const { guildId, guilds, isSuperAdmin } = useGuild();
      return (
        <div>
          <span data-testid="guildId">{guildId}</span>
          <span data-testid="guildCount">{guilds.length}</span>
          <span data-testid="isSuperAdmin">{String(isSuperAdmin)}</span>
        </div>
      );
    }

    render(
      <GuildProvider>
        <TestComponent />
      </GuildProvider>
    );

    // guildId should come from auth-store mock (guild-123)
    // guilds should be loaded from API
    expect(screen.getByTestId("guildId").textContent).toBe("guild-123");
    expect(screen.getByTestId("isSuperAdmin").textContent).toBe("false");
  });
});

describe("useGuild", () => {
  it("should return default context values outside provider", () => {
    function TestComponent() {
      const { guildId, guilds, isSuperAdmin } = useGuild();
      return (
        <div>
          <span data-testid="useGuildId">{guildId}</span>
          <span data-testid="useGuildCount">{guilds.length}</span>
          <span data-testid="useGuildSuperAdmin">{String(isSuperAdmin)}</span>
        </div>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("useGuildId").textContent).toBe("");
    expect(screen.getByTestId("useGuildCount").textContent).toBe("0");
    expect(screen.getByTestId("useGuildSuperAdmin").textContent).toBe("false");
  });
});
